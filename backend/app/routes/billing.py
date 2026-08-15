# ==============================================================================
# PURPOSE: HTTP surface for Stripe billing.
# DATA FLOW: Dashboard -> checkout/portal (authenticated) -> Stripe;
#            Stripe -> webhook (signature-verified) -> StripeSubscription.
# ARCHITECTURAL DECISION:
# - Authenticated routes reuse EVE's existing dependencies, so billing inherits
#   tenant isolation rather than defining its own.
# - Checkout accepts a plan KEY and interval, never a price or amount — the
#   route resolves the real Stripe price id server-side (stripe_service).
#   Nothing here ever writes a plan/status the client supplied.
# - The webhook is necessarily unauthenticated in EVE's terms (Stripe has no
#   EVE session); it is authenticated instead by the Stripe-Signature header.
# ==============================================================================

import logging
import uuid

import stripe as stripe_sdk
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.plans import PLANS, entitlement_for_workspace, normalize_plan_key, serialize_plan
from app.core.rate_limiter import rate_limit
from app.core.security import get_current_user, get_required_workspace_id, require_workspace_role
from app.database import get_db
from app.models.profile import Profile
from app.services.audit_logger import AuditLogger
from app.services.billing.stripe_service import (
    StripeError,
    claim_webhook_event,
    close_webhook_event,
    create_checkout_session,
    create_portal_session,
    handle_event,
    is_configured,
    verify_and_parse_event,
)

logger = logging.getLogger("eve.routes.billing")

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    plan: str
    interval: str = "month"


def _frontend_url(path: str) -> str:
    base = (settings.FRONTEND_URL or "").split(",")[0].strip().rstrip("/")
    if not base:
        base = "http://localhost:3000"
    return f"{base}{path}"


@router.get("/plans")
def list_plans():
    """Public plan catalogue — same three plans shown on the pricing page."""
    return {"plans": [serialize_plan(p) for p in PLANS.values()]}


@router.get("/status")
def billing_status(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("member")),
):
    """
    The workspace's real entitlement state, resolved server-side.

    This is the ONLY place the frontend should read plan/subscription state
    from — never from a cached value it stores itself.
    """
    entitlement = entitlement_for_workspace(db, workspace_id)
    plan = entitlement["plan"]
    subscription = entitlement.get("subscription")

    return {
        "active": entitlement["active"],
        "source": entitlement["source"],
        "status": entitlement["status"],
        "plan": serialize_plan(plan),
        "trial_ends_at": entitlement.get("trial_ends_at"),
        "current_period_end": entitlement.get("current_period_end"),
        "cancel_at_period_end": bool(subscription.cancel_at_period_end) if subscription else False,
        "billing_interval": subscription.billing_interval if subscription else None,
        "configured": is_configured(),
    }


@router.post("/checkout")
def start_checkout(
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
    _limit: None = Depends(rate_limit(requests=10, window_seconds=60)),
):
    """
    Begins a Stripe Checkout session. Admin-only: subscribing changes what the
    whole workspace can do, so it is not a member-level action.
    """
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this EVE deployment.",
        )

    plan_key = normalize_plan_key(body.plan)
    if body.plan.strip().lower() not in PLANS and plan_key not in PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan.")
    interval = "year" if body.interval in ("year", "annual", "annually") else "month"

    try:
        url = create_checkout_session(
            db=db,
            organization_id=workspace_id,
            user=current_user,
            plan_key=plan_key,
            interval=interval,
            success_url=_frontend_url("/dashboard/billing?checkout=success"),
            cancel_url=_frontend_url("/dashboard/billing?checkout=canceled"),
        )
    except StripeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except stripe_sdk.StripeError as exc:
        logger.error("Stripe checkout failed for workspace %s: %s", workspace_id, exc)
        raise HTTPException(status_code=502, detail="Could not reach Stripe.")

    AuditLogger.log(
        db=db,
        event_type="billing_checkout_started",
        status="success",
        organization_id=workspace_id,
        message=f"Checkout started for plan={plan_key} interval={interval}",
        metadata_json={"plan": plan_key, "interval": interval},
    )
    return {"checkout_url": url}


@router.post("/portal")
def open_portal(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
    _limit: None = Depends(rate_limit(requests=10, window_seconds=60)),
):
    """Opens the Stripe Billing Portal — upgrade, downgrade, cancel, payment method."""
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this EVE deployment.",
        )
    try:
        url = create_portal_session(db, workspace_id, _frontend_url("/dashboard/billing"))
    except StripeError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except stripe_sdk.StripeError as exc:
        logger.error("Stripe portal session failed for workspace %s: %s", workspace_id, exc)
        raise HTTPException(status_code=502, detail="Could not reach Stripe.")
    return {"portal_url": url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives Stripe webhooks.

    Answers 200 once the signature is valid, including for events that could
    not be applied (e.g. an unresolvable workspace) — a non-2xx makes Stripe
    retry, and retrying a permanently unprocessable event only disables the
    endpoint eventually. Signature failures still answer 400.
    """
    raw_body = await request.body()
    signature = request.headers.get("Stripe-Signature")

    try:
        event = verify_and_parse_event(raw_body, signature)
    except StripeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        logger.warning("Rejected Stripe webhook: signature verification failed.")
        raise HTTPException(status_code=400, detail="Invalid signature.")

    event_id = event["id"]
    event_type = event["type"]

    record = claim_webhook_event(db, event_id, event_type)
    if record is None:
        return {"status": "duplicate"}

    try:
        outcome = handle_event(db, event)
        close_webhook_event(db, record, "processed")
        return {"status": "processed", "outcome": outcome}
    except Exception as exc:
        db.rollback()
        logger.error("Stripe webhook %s (%s) failed: %s", event_id, event_type, exc, exc_info=True)
        close_webhook_event(db, record, "failed", str(exc))
        return {"status": "failed"}
