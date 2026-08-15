# ==============================================================================
# PURPOSE: HTTP surface for the Shopify store integration.
# DATA FLOW: Dashboard -> install -> Shopify consent -> callback -> sync;
#            Shopify -> webhook -> canonical EVE models.
# EXTENSION POINTS: Add a scheduled delta-sync trigger (Cloud Scheduler -> /sync).
# ARCHITECTURAL DECISION:
# - Authenticated routes reuse the existing dependencies (get_current_user,
#   get_required_workspace_id, require_workspace_role) so Shopify inherits EVE's
#   tenant isolation rather than defining its own.
# - The callback and webhook are necessarily UNauthenticated in EVE's terms —
#   Shopify has no EVE session. They are authenticated instead by Shopify's own
#   HMAC plus, for the callback, a single-use state nonce.
# ==============================================================================

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.plans import (
    BillingRequired,
    PlanLimitExceeded,
    enforce_shopify_store_limit,
    http_plan_error,
)
from app.core.rate_limiter import rate_limit
from app.core.security import (
    get_current_user,
    get_required_workspace_id,
    require_workspace_role,
)
from app.database import SessionLocal, get_db
from app.models.profile import Profile
from app.models.shopify import ShopifyConnection, ShopifySyncJob
from app.services.audit_logger import AuditLogger
from app.services.shopify.oauth_service import (
    ShopifyOAuthError,
    ShopifyOAuthService,
    is_configured,
)
from app.services.ai.proactive_analysis_service import ProactiveAnalysisService
from app.services.shopify.sync_service import ShopifySyncService
from app.services.shopify.webhook_service import (
    ShopifyWebhookService,
    verify_webhook_hmac,
)

logger = logging.getLogger("eve.routes.integrations_shopify")

router = APIRouter(prefix="/api/integrations/shopify", tags=["integrations"])


class InstallRequest(BaseModel):
    shop_domain: str


class InstallResponse(BaseModel):
    authorize_url: str


def _frontend_integrations_url(status_value: str, detail: str = "") -> str:
    """
    Where the founder's browser lands after the OAuth round trip.

    Uses the first configured frontend origin: FRONTEND_URL may hold a
    comma-separated CORS list, and sending a browser to "a,b" would 404.
    """
    base = (settings.FRONTEND_URL or "").split(",")[0].strip().rstrip("/")
    if not base:
        base = "http://localhost:3000"
    url = f"{base}/dashboard/integrations?shopify={status_value}"
    if detail:
        from urllib.parse import quote

        url += f"&detail={quote(detail)}"
    return url


def _run_sync_in_background(connection_id: uuid.UUID, job_type: str) -> None:
    """
    Runs a sync on its own database session.

    A BackgroundTask outlives the request, so the request-scoped session from
    get_db() is already closed by the time this executes; reusing it raises
    DetachedInstanceError partway through the sync.
    """
    import asyncio

    db = SessionLocal()
    try:
        connection = (
            db.query(ShopifyConnection)
            .filter(ShopifyConnection.id == connection_id)
            .first()
        )
        if not connection:
            logger.warning("Background sync skipped: connection %s is gone.", connection_id)
            return
        job = asyncio.run(ShopifySyncService.run_sync(db, connection, job_type=job_type))

        # Matches the CSV-upload founder experience (see
        # ProactiveAnalysisService's own docstring: "automatic on CSV upload").
        # Without this, a founder who connects Shopify — Part 12's primary
        # onboarding path — saw an empty dashboard until they typed a question
        # themselves, unlike a founder who uploads a CSV. Only the FIRST sync
        # triggers it: a delta sync re-running proactive analysis on every
        # webhook-driven refresh would re-bill and re-analyse for no founder
        # benefit, since nothing new has necessarily happened.
        if job_type == "initial" and job.status == "success":
            org_id = connection.organization_id
            user_id = connection.connected_by_user_id
            try:
                asyncio.run(
                    ProactiveAnalysisService.generate_baseline_recommendations_async(
                        org_id, user_id
                    )
                )
            except Exception as exc:
                # A failed baseline analysis must not be reported as a failed
                # sync — the Shopify data is safely in EVE either way, and the
                # founder can trigger analysis themselves from the dashboard.
                logger.error(
                    "Post-sync baseline analysis failed for org %s: %s",
                    org_id, exc, exc_info=True,
                )
    except Exception as exc:
        logger.error("Background Shopify sync failed: %s", exc, exc_info=True)
    finally:
        db.close()


def _register_webhooks_in_background(connection_id: uuid.UUID) -> None:
    """Registers webhook subscriptions after a successful connection."""
    import asyncio

    db = SessionLocal()
    try:
        connection = (
            db.query(ShopifyConnection)
            .filter(ShopifyConnection.id == connection_id)
            .first()
        )
        if connection:
            asyncio.run(ShopifyWebhookService.register_all(db, connection))
    except Exception as exc:
        logger.error("Shopify webhook registration failed: %s", exc, exc_info=True)
    finally:
        db.close()


# ------------------------------------------------------------------ status / OAuth


@router.get("/status")
def get_status(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("member")),
):
    """Connection and synchronisation state for the caller's active workspace."""
    connection = (
        db.query(ShopifyConnection)
        .filter(
            ShopifyConnection.organization_id == workspace_id,
            ShopifyConnection.status != "disconnected",
        )
        .first()
    )

    if not connection:
        return {
            "connected": False,
            "configured": is_configured(),
            "shop_domain": None,
            "status": "not_connected",
            "sync_status": "idle",
            "last_sync_at": None,
            "last_successful_sync_at": None,
            "last_error": None,
            "recent_jobs": [],
        }

    recent_jobs = (
        db.query(ShopifySyncJob)
        .filter(ShopifySyncJob.organization_id == workspace_id)
        .order_by(ShopifySyncJob.started_at.desc())
        .limit(5)
        .all()
    )

    return {
        "connected": connection.status == "connected",
        "configured": is_configured(),
        "shop_domain": connection.shop_domain,
        "status": connection.status,
        "sync_status": connection.sync_status,
        "last_sync_at": connection.last_sync_at,
        "last_successful_sync_at": connection.last_successful_sync_at,
        "last_error": connection.last_error,
        "recent_jobs": [
            {
                "id": str(job.id),
                "job_type": job.job_type,
                "status": job.status,
                "products_synced": job.products_synced,
                "variants_synced": job.variants_synced,
                "inventory_synced": job.inventory_synced,
                "orders_synced": job.orders_synced,
                "sales_records_synced": job.sales_records_synced,
                "started_at": job.started_at,
                "finished_at": job.finished_at,
                "error_message": job.error_message,
            }
            for job in recent_jobs
        ],
    }


@router.post("/install", response_model=InstallResponse)
def start_install(
    body: InstallRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
    _limit: None = Depends(rate_limit(requests=10, window_seconds=60)),
):
    """
    Begins the OAuth flow. Admin-only: connecting a store changes what the whole
    workspace sees, so it is not a member-level action.
    """
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Shopify is not configured on this EVE deployment.",
        )

    try:
        shop_domain = ShopifyOAuthService.validate_shop_param(body.shop_domain)
    except ShopifyOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    existing = (
        db.query(ShopifyConnection)
        .filter(ShopifyConnection.shop_domain == shop_domain)
        .first()
    )
    if existing and existing.organization_id != workspace_id:
        # Refused up front so the founder gets a clear message instead of
        # completing a Shopify consent screen that will then be rejected.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Shopify store is already connected to another EVE workspace.",
        )

    # Plan store-count enforcement. Skipped when this exact shop is already
    # this workspace's own connection (a reconnect after disconnect/token
    # refresh does not consume an additional store slot).
    already_owns_this_shop = bool(existing and existing.organization_id == workspace_id)
    if not already_owns_this_shop:
        try:
            enforce_shopify_store_limit(db, workspace_id, adding=1)
        except PlanLimitExceeded as exc:
            raise http_plan_error(exc)
        except BillingRequired as exc:
            raise http_plan_error(exc)

    state = ShopifyOAuthService.create_state(
        db, workspace_id, current_user.id, shop_domain
    )

    AuditLogger.log(
        db=db,
        event_type="shopify_install_started",
        status="success",
        organization_id=workspace_id,
        message=f"Shopify OAuth started for {shop_domain}",
        metadata_json={"shop_domain": shop_domain},
    )

    return InstallResponse(
        authorize_url=ShopifyOAuthService.build_install_url(shop_domain, state)
    )


@router.get("/callback")
async def oauth_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Shopify's OAuth redirect target.

    Unauthenticated by necessity — the browser arrives from Shopify with no EVE
    session. Trust is established by the callback HMAC (proves Shopify sent it) and
    the single-use state nonce (proves EVE started it, and identifies the workspace).
    """
    params = dict(request.query_params)

    if not is_configured():
        return RedirectResponse(_frontend_integrations_url("error", "not_configured"))

    if not ShopifyOAuthService.verify_callback_hmac(params):
        logger.warning("Shopify callback rejected: HMAC verification failed.")
        return RedirectResponse(_frontend_integrations_url("error", "invalid_signature"))

    shop = params.get("shop", "")
    code = params.get("code", "")
    state = params.get("state", "")
    if not shop or not code or not state:
        return RedirectResponse(_frontend_integrations_url("error", "missing_parameters"))

    try:
        shop_domain = ShopifyOAuthService.validate_shop_param(shop)
    except ShopifyOAuthError:
        return RedirectResponse(_frontend_integrations_url("error", "invalid_shop"))

    state_record = ShopifyOAuthService.consume_state(db, state, shop_domain)
    if not state_record:
        return RedirectResponse(_frontend_integrations_url("error", "invalid_state"))

    try:
        access_token, scopes = await ShopifyOAuthService.exchange_code(shop_domain, code)
        connection = ShopifyOAuthService.upsert_connection(
            db=db,
            organization_id=state_record.organization_id,
            user_id=state_record.user_id,
            shop_domain=shop_domain,
            access_token=access_token,
            scopes=scopes,
        )
    except ShopifyOAuthError as exc:
        logger.error("Shopify OAuth failed for %s: %s", shop_domain, exc)
        return RedirectResponse(_frontend_integrations_url("error", str(exc)[:120]))
    except Exception as exc:
        logger.error("Unexpected Shopify OAuth failure: %s", exc, exc_info=True)
        return RedirectResponse(_frontend_integrations_url("error", "connection_failed"))

    AuditLogger.log(
        db=db,
        event_type="shopify_connected",
        status="success",
        organization_id=connection.organization_id,
        message=f"Shopify store {shop_domain} connected",
        metadata_json={"shop_domain": shop_domain, "scopes": scopes},
    )

    background_tasks.add_task(_register_webhooks_in_background, connection.id)
    background_tasks.add_task(_run_sync_in_background, connection.id, "initial")

    return RedirectResponse(_frontend_integrations_url("connected"))


# ------------------------------------------------------------------ sync / manage


@router.post("/sync")
def trigger_sync(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
    _limit: None = Depends(rate_limit(requests=5, window_seconds=300)),
):
    """Manually triggers a delta sync for the caller's workspace."""
    connection = (
        db.query(ShopifyConnection)
        .filter(
            ShopifyConnection.organization_id == workspace_id,
            ShopifyConnection.status == "connected",
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="No connected Shopify store.")

    if connection.sync_status == "running":
        # Concurrent syncs would race on the same upserts and waste Shopify's
        # rate-limit budget for no additional data.
        return {"status": "already_running", "sync_status": "running"}

    background_tasks.add_task(_run_sync_in_background, connection.id, "delta")
    return {"status": "started", "sync_status": "running"}


@router.get("/reconcile")
async def reconcile(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
    _limit: None = Depends(rate_limit(requests=5, window_seconds=300)),
):
    """Reports stock drift between EVE and Shopify without writing anything."""
    connection = (
        db.query(ShopifyConnection)
        .filter(
            ShopifyConnection.organization_id == workspace_id,
            ShopifyConnection.status == "connected",
        )
        .first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="No connected Shopify store.")

    try:
        return await ShopifySyncService.reconcile(db, connection)
    except Exception as exc:
        logger.error("Shopify reconciliation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not reach Shopify.")


@router.delete("/disconnect")
async def disconnect(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
):
    """
    Disconnects the store.

    Synced Products, InventoryItems and SalesRecords are KEPT: they are ordinary
    EVE business data at this point, referenced by recommendation traces and
    historical analyses. Deleting them would silently rewrite the founder's past
    reports. Only the credential and the external mappings are removed.
    """
    connection = (
        db.query(ShopifyConnection)
        .filter(ShopifyConnection.organization_id == workspace_id)
        .first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="No Shopify store connected.")

    await ShopifyWebhookService.unregister_all(connection)

    AuditLogger.log(
        db=db,
        event_type="shopify_disconnected",
        status="success",
        organization_id=workspace_id,
        message=f"Shopify store {connection.shop_domain} disconnected",
        metadata_json={"shop_domain": connection.shop_domain},
    )

    # Deleting the row (rather than flagging it) removes the encrypted token and
    # frees the shop_domain unique slot so the store can be connected elsewhere.
    db.delete(connection)
    db.commit()
    return {"status": "disconnected"}


# ---------------------------------------------------------------------- webhooks


@router.post("/webhook")
async def shopify_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives Shopify webhooks.

    Always answers 200 once the signature is valid, including for payloads that
    cannot be applied: a non-2xx makes Shopify retry, and retrying a permanently
    unprocessable event achieves nothing but eventually disables the subscription.
    Genuine authentication failures still answer 401.
    """
    raw_body = await request.body()

    if not verify_webhook_hmac(raw_body, request.headers.get("X-Shopify-Hmac-Sha256")):
        logger.warning("Rejected Shopify webhook: invalid HMAC.")
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    topic = request.headers.get("X-Shopify-Topic", "")
    shop_domain = request.headers.get("X-Shopify-Shop-Domain", "")
    webhook_id = request.headers.get("X-Shopify-Webhook-Id", "")

    if not webhook_id:
        # Without the delivery id there is no deduplication key, and reprocessing
        # an order event would restate sales from a partial payload.
        logger.warning("Rejected Shopify webhook: missing X-Shopify-Webhook-Id.")
        raise HTTPException(status_code=400, detail="Missing webhook id.")

    connection = ShopifyWebhookService.resolve_connection(db, shop_domain)
    organization_id = connection.organization_id if connection else None

    event = ShopifyWebhookService.claim_event(
        db, webhook_id, topic, shop_domain, organization_id
    )
    if event is None:
        return {"status": "duplicate"}

    if not connection:
        ShopifyWebhookService.close_event(db, event, "ignored", "Unknown shop domain.")
        return {"status": "ignored"}

    try:
        import json

        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except (ValueError, UnicodeDecodeError):
        ShopifyWebhookService.close_event(db, event, "failed", "Malformed JSON body.")
        return {"status": "ignored"}

    try:
        outcome = await ShopifyWebhookService.handle_event(db, connection, topic, payload)
        ShopifyWebhookService.close_event(db, event, "processed")
        return {"status": "processed", "outcome": outcome}
    except Exception as exc:
        db.rollback()
        logger.error(
            "Shopify webhook %s (%s) failed: %s", webhook_id, topic, exc, exc_info=True
        )
        ShopifyWebhookService.close_event(db, event, "failed", str(exc))
        return {"status": "failed"}
