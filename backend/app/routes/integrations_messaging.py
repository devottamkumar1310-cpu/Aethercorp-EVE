# ==============================================================================
# PURPOSE: HTTP surface for the Telegram and WhatsApp channels.
# DATA FLOW: Provider webhook -> signature verification -> idempotency claim ->
#            channel adapter -> EveChannelService -> AgentOrchestrator -> reply send.
# EXTENSION POINTS: Add a provider by adding a webhook pair here plus an adapter.
# ARCHITECTURAL DECISION:
# - Webhooks answer 200 for anything that is authentic but unprocessable, so the
#   provider stops retrying. Failed AUTHENTICATION answers 401/403, because that
#   is not a delivery the provider should keep trying either way.
# - Link-code management is authenticated with EVE's normal workspace dependencies;
#   only the provider-facing webhooks are outside the session model.
# ==============================================================================

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.plans import BillingRequired, PlanLimitExceeded, http_plan_error, require_capability
from app.core.rate_limiter import rate_limit
from app.core.security import (
    get_current_user,
    get_required_workspace_id,
    require_workspace_role,
)
from app.database import get_db
from app.models.channel import (
    CHANNEL_TELEGRAM,
    CHANNEL_WHATSAPP,
    SUPPORTED_CHANNELS,
)
from app.models.profile import Profile
from app.services.channels import idempotency
from app.services.channels.link_service import CODE_TTL_MINUTES, ChannelLinkService
from app.services.channels.telegram_service import TelegramService
from app.services.channels.telegram_service import is_configured as telegram_configured
from app.services.channels.telegram_service import verify_secret_token
from app.services.channels.whatsapp_service import WhatsAppService
from app.services.channels.whatsapp_service import is_configured as whatsapp_configured
from app.services.channels.whatsapp_service import verify_signature, verify_subscription

logger = logging.getLogger("eve.routes.integrations_messaging")

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class LinkCodeRequest(BaseModel):
    channel: str = Field(..., description="telegram or whatsapp")


# ------------------------------------------------------------- authenticated API


@router.get("/channels/status")
def channels_status(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("member")),
):
    """Link state for both messaging channels in the caller's workspace."""
    result = {}
    for channel, configured in (
        (CHANNEL_TELEGRAM, telegram_configured()),
        (CHANNEL_WHATSAPP, whatsapp_configured()),
    ):
        links = ChannelLinkService.list_links(db, workspace_id, channel)
        result[channel] = {
            "connected": bool(links),
            "configured": configured,
            "linked_accounts": [
                {
                    # Never the raw identifier — display_hint is the only
                    # user-facing form of an external account.
                    "display_hint": link.display_hint,
                    "created_at": link.created_at,
                    "last_message_at": link.last_message_at,
                }
                for link in links
            ],
        }
    return result


@router.post("/channels/link-code")
def create_link_code(
    body: LinkCodeRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
    _limit: None = Depends(rate_limit(requests=10, window_seconds=60)),
):
    """
    Issues a single-use code that links a chat account to this workspace.

    Admin-only: a link grants read access to the workspace's whole business
    picture from a device outside EVE's session model.
    """
    channel = (body.channel or "").strip().lower()
    if channel not in SUPPORTED_CHANNELS:
        raise HTTPException(status_code=400, detail="Unsupported channel.")

    # Every plan grants Telegram, but issuance still requires an ACTIVE
    # workspace (a live trial or subscription) — an expired trial with no
    # subscription must not be able to onboard a new channel at all, even one
    # every plan tier would otherwise include. WhatsApp additionally requires
    # Command+, which require_capability enforces on top of the same
    # underlying activity check.
    try:
        require_capability(db, workspace_id, channel)
    except (PlanLimitExceeded, BillingRequired) as exc:
        raise http_plan_error(exc)

    record = ChannelLinkService.issue_code(db, workspace_id, current_user.id, channel)
    return {
        "code": record.code,
        "channel": channel,
        "expires_at": record.expires_at,
        "expires_in_minutes": CODE_TTL_MINUTES,
        "instructions": f"Send '/connect {record.code}' to the EVE bot on {channel}.",
    }


@router.post("/channels/alerts/send")
async def send_alerts(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
    _limit: None = Depends(rate_limit(requests=5, window_seconds=300)),
):
    """
    Builds proactive alerts from the workspace's EXISTING recommendations and
    delivers them to its linked chat accounts.

    Exposed as an explicit trigger so the alert path is verifiable end to end and
    can be driven on a schedule (Cloud Scheduler -> this endpoint) without a
    second alerting system. Returns zero alerts when nothing warrants one.
    """
    from app.services.channels.alert_engine import AlertEngine

    alerts = AlertEngine.build_alerts(db, workspace_id)
    result = await AlertEngine.dispatch(db, workspace_id, alerts)
    result["previews"] = [alert.render() for alert in alerts]
    return result


@router.delete("/channels/{channel}")
def unlink_channel(
    channel: str,
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role=Depends(require_workspace_role("admin")),
):
    """Revokes every link of a channel for the caller's workspace."""
    normalized = (channel or "").strip().lower()
    if normalized not in SUPPORTED_CHANNELS:
        raise HTTPException(status_code=400, detail="Unsupported channel.")

    revoked = ChannelLinkService.revoke(db, workspace_id, normalized)
    return {"status": "unlinked", "revoked": revoked}


# --------------------------------------------------------------------- Telegram


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives Telegram updates.

    Authenticated by the X-Telegram-Bot-Api-Secret-Token header that Telegram
    echoes from setWebhook. Without a configured secret the endpoint rejects
    everything rather than accepting anonymous updates.
    """
    if not verify_secret_token(request.headers.get("X-Telegram-Bot-Api-Secret-Token")):
        logger.warning("Rejected Telegram update: bad or missing secret token.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    try:
        update = await request.json()
    except Exception:
        return {"status": "ignored"}

    message = TelegramService.extract_message(update)
    if not message:
        # Edits, media, callbacks and channel posts land here. Acknowledged so
        # Telegram does not redeliver an update EVE will never act on.
        return {"status": "ignored"}

    update_id = message.get("update_id")
    if update_id is None:
        return {"status": "ignored"}

    event = idempotency.claim_event(db, CHANNEL_TELEGRAM, str(update_id))
    if event is None:
        return {"status": "duplicate"}

    try:
        reply = await TelegramService.handle_message(db, message)
        await TelegramService.send_message(message["chat_id"], reply)
        idempotency.mark_processed(db, event)
        return {"status": "processed"}
    except Exception as exc:
        db.rollback()
        logger.error("Telegram update handling failed: %s", exc, exc_info=True)
        idempotency.mark_failed(db, event, str(exc))
        # 200 with a failure body: retrying would re-run the same failing analysis
        # and bill the merchant again for a reply they still would not receive.
        return {"status": "failed"}


# --------------------------------------------------------------------- WhatsApp


@router.get("/whatsapp/webhook")
async def whatsapp_verify(request: Request):
    """
    Meta's one-time subscription handshake.

    Must echo hub.challenge as a bare text body — Meta rejects a JSON envelope.
    """
    params = request.query_params
    if verify_subscription(params.get("hub.mode"), params.get("hub.verify_token")):
        challenge = params.get("hub.challenge", "")
        return Response(content=challenge, media_type="text/plain")

    logger.warning("Rejected WhatsApp webhook verification: bad verify token.")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives WhatsApp Cloud API webhooks.

    Authenticated by X-Hub-Signature-256 over the raw body. The body is read as
    bytes before parsing, because re-serialising the JSON changes the bytes and
    would break every signature check.
    """
    raw_body = await request.body()

    if not verify_signature(raw_body, request.headers.get("X-Hub-Signature-256")):
        logger.warning("Rejected WhatsApp webhook: invalid signature.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    try:
        import json

        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except (ValueError, UnicodeDecodeError):
        return {"status": "ignored"}

    messages = WhatsAppService.extract_messages(payload)
    if not messages:
        # Delivery/read status callbacks arrive on this endpoint too.
        return {"status": "ignored"}

    processed = 0
    for message in messages:
        event = idempotency.claim_event(db, CHANNEL_WHATSAPP, message["message_id"])
        if event is None:
            continue

        try:
            reply = await WhatsAppService.handle_message(db, message)
            await WhatsAppService.send_message(message["from_number"], reply)
            idempotency.mark_processed(db, event)
            processed += 1
        except Exception as exc:
            db.rollback()
            logger.error("WhatsApp message handling failed: %s", exc, exc_info=True)
            idempotency.mark_failed(db, event, str(exc))

    return {"status": "processed", "handled": processed}
