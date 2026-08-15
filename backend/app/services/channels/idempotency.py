# ==============================================================================
# PURPOSE: Exactly-once processing for inbound channel messages.
# DATA FLOW: Webhook adapter -> claim() before doing work -> mark_processed()/mark_failed().
# ARCHITECTURAL DECISION:
# - The claim is a database INSERT guarded by a unique constraint, not a read-then-write.
#   Telegram and Meta both retry aggressively and can deliver the same update to two
#   workers concurrently; a SELECT-then-INSERT check would let both pass and answer
#   (and bill) twice. Letting the constraint arbitrate makes exactly one claim win.
# ==============================================================================

import datetime
import logging
import uuid
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.channel import ChannelMessageEvent

logger = logging.getLogger("eve.services.channels.idempotency")


def claim_event(
    db: Session,
    channel: str,
    external_event_id: str,
    organization_id: Optional[uuid.UUID] = None,
) -> Optional[ChannelMessageEvent]:
    """
    Claims an inbound event for processing.

    Returns the new event row on success, or None when this event has already been
    claimed — in which case the caller must acknowledge the delivery without acting
    on it, so the provider stops retrying.
    """
    event = ChannelMessageEvent(
        channel=channel,
        external_event_id=str(external_event_id),
        organization_id=organization_id,
        status="received",
        received_at=datetime.datetime.utcnow(),
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.info(
            "Duplicate %s event %s ignored (already claimed).", channel, external_event_id
        )
        return None

    db.refresh(event)
    return event


def mark_processed(
    db: Session,
    event: ChannelMessageEvent,
    organization_id: Optional[uuid.UUID] = None,
    status: str = "processed",
) -> None:
    """Closes out a claimed event. Best-effort: never masks the handler's own result."""
    try:
        event.status = status
        event.processed_at = datetime.datetime.utcnow()
        if organization_id is not None:
            event.organization_id = organization_id
        db.commit()
    except Exception as exc:  # pragma: no cover - bookkeeping only
        logger.warning("Failed to record channel event outcome: %s", exc)
        db.rollback()


def mark_failed(db: Session, event: ChannelMessageEvent, error: str) -> None:
    """
    Records a processing failure.

    The row is left in place so a provider retry is still deduplicated. Answering a
    failed question twice would double-bill the merchant's AI budget for a result
    they never received either time.
    """
    try:
        event.status = "failed"
        event.error_message = error[:500]
        event.processed_at = datetime.datetime.utcnow()
        db.commit()
    except Exception as exc:  # pragma: no cover - bookkeeping only
        logger.warning("Failed to record channel event failure: %s", exc)
        db.rollback()
