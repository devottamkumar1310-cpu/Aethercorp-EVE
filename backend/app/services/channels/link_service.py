# ==============================================================================
# PURPOSE: Binds an external messaging identity (Telegram chat, WhatsApp number)
#          to an EVE workspace + user via a short-lived one-time code.
# DATA FLOW: Dashboard issues a code -> founder sends it to the bot -> redeem_code()
#            creates a ChannelLink -> every later message resolves through resolve_link().
# EXTENSION POINTS: Add per-link role scoping if EVE ever exposes write actions
#          over chat; today a link is read-only intelligence access.
# ARCHITECTURAL DECISION:
# - Possession of a code is the ONLY proof accepted. EVE never infers a workspace
#   from a phone number, username or display name: those are supplied by the caller
#   and trusting them would let an outsider address another tenant's data.
# - Codes are single-use and expire quickly, so an intercepted code has a small
#   window and cannot be replayed to attach a second account.
# ==============================================================================

import datetime
import logging
import secrets
import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.core.crypto import decrypt, encrypt, hash_external_id
from app.database import as_naive_utc
from app.models.channel import (
    SUPPORTED_CHANNELS,
    ChannelLink,
    ChannelLinkCode,
)
from app.models.organization import Membership

logger = logging.getLogger("eve.services.channels.link_service")

# Codes are read off a screen and typed into a chat, so they must be short. The
# entropy is bounded by the 10-minute expiry and single use rather than by length.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no O/0, I/1 confusion
_CODE_LENGTH = 8
CODE_TTL_MINUTES = 10


@dataclass(frozen=True)
class ResolvedLink:
    """A verified external identity, resolved to the workspace it may access."""

    link_id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    channel: str
    delivery_address: str


class ChannelLinkService:
    @staticmethod
    def _generate_code() -> str:
        return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))

    @classmethod
    def issue_code(
        cls,
        db: Session,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        channel: str,
    ) -> ChannelLinkCode:
        """
        Issues a fresh single-use link code for the caller's active workspace.

        The caller's membership is verified by the route dependency before this is
        reached; the code therefore carries an already-authorised (org, user) pair.
        """
        if channel not in SUPPORTED_CHANNELS:
            raise ValueError(f"Unsupported channel: {channel}")

        now = datetime.datetime.utcnow()

        # Supersede any outstanding code for this (user, workspace, channel) so only
        # the most recently displayed code is live.
        (
            db.query(ChannelLinkCode)
            .filter(
                ChannelLinkCode.organization_id == organization_id,
                ChannelLinkCode.user_id == user_id,
                ChannelLinkCode.channel == channel,
                ChannelLinkCode.consumed_at.is_(None),
            )
            .update({ChannelLinkCode.consumed_at: now}, synchronize_session=False)
        )

        record = ChannelLinkCode(
            code=cls._generate_code(),
            organization_id=organization_id,
            user_id=user_id,
            channel=channel,
            created_at=now,
            expires_at=now + datetime.timedelta(minutes=CODE_TTL_MINUTES),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(
            "Issued %s link code for org=%s user=%s", channel, organization_id, user_id
        )
        return record

    @classmethod
    def redeem_code(
        cls,
        db: Session,
        code: str,
        channel: str,
        external_id: str,
        delivery_address: str,
        display_hint: Optional[str] = None,
    ) -> Optional[ResolvedLink]:
        """
        Redeems a code sent through the bot and creates (or re-points) the link.

        Returns None when the code is unknown, expired, already used, or issued for
        a different channel. Callers must not distinguish these cases to the user
        beyond "invalid or expired" — enumerating them would help a guesser.
        """
        if not code or channel not in SUPPORTED_CHANNELS:
            return None

        normalized = code.strip().upper()
        now = datetime.datetime.utcnow()

        record = (
            db.query(ChannelLinkCode)
            .filter(
                ChannelLinkCode.code == normalized,
                ChannelLinkCode.channel == channel,
                ChannelLinkCode.consumed_at.is_(None),
            )
            .first()
        )
        if not record or as_naive_utc(record.expires_at) <= now:
            logger.warning("Rejected %s link attempt: invalid or expired code.", channel)
            return None

        # The membership that justified the code may have been revoked between
        # issuing and redeeming, so re-check it rather than trusting the code alone.
        membership = (
            db.query(Membership)
            .filter(
                Membership.user_id == record.user_id,
                Membership.organization_id == record.organization_id,
            )
            .first()
        )
        if not membership:
            record.consumed_at = now
            db.commit()
            logger.warning(
                "Rejected %s link: user %s is no longer a member of workspace %s.",
                channel,
                record.user_id,
                record.organization_id,
            )
            return None

        external_hash = hash_external_id(external_id)
        link = (
            db.query(ChannelLink)
            .filter(
                ChannelLink.channel == channel,
                ChannelLink.external_id_hash == external_hash,
            )
            .first()
        )

        if link:
            # Re-linking points the same external identity at the redeemed workspace.
            # This is how a founder moves their bot between their own workspaces.
            link.organization_id = record.organization_id
            link.user_id = record.user_id
            link.delivery_address_encrypted = encrypt(delivery_address)
            link.display_hint = display_hint
            link.status = "active"
            link.revoked_at = None
        else:
            link = ChannelLink(
                organization_id=record.organization_id,
                user_id=record.user_id,
                channel=channel,
                external_id_hash=external_hash,
                delivery_address_encrypted=encrypt(delivery_address),
                display_hint=display_hint,
                status="active",
                created_at=now,
            )
            db.add(link)

        record.consumed_at = now
        db.commit()
        db.refresh(link)

        logger.info(
            "Linked %s identity to workspace %s (user %s).",
            channel,
            record.organization_id,
            record.user_id,
        )
        return ResolvedLink(
            link_id=link.id,
            organization_id=link.organization_id,
            user_id=link.user_id,
            channel=channel,
            delivery_address=delivery_address,
        )

    @classmethod
    def resolve_link(
        cls, db: Session, channel: str, external_id: str
    ) -> Optional[ResolvedLink]:
        """
        Resolves an inbound external identity to its workspace. None when unlinked.
        This is the single authorisation gate for every inbound channel message.
        """
        if not external_id or channel not in SUPPORTED_CHANNELS:
            return None

        link = (
            db.query(ChannelLink)
            .filter(
                ChannelLink.channel == channel,
                ChannelLink.external_id_hash == hash_external_id(external_id),
                ChannelLink.status == "active",
            )
            .first()
        )
        if not link:
            return None

        try:
            delivery_address = decrypt(link.delivery_address_encrypted)
        except Exception:
            # A link we cannot decrypt is unusable; treat it as unlinked rather than
            # replying to an address we cannot verify.
            logger.error("Channel link %s has undecryptable delivery address.", link.id)
            return None

        return ResolvedLink(
            link_id=link.id,
            organization_id=link.organization_id,
            user_id=link.user_id,
            channel=channel,
            delivery_address=delivery_address,
        )

    @staticmethod
    def touch(db: Session, link_id: uuid.UUID) -> None:
        """Records last activity. Best-effort; never fails the message being handled."""
        try:
            link = db.query(ChannelLink).filter(ChannelLink.id == link_id).first()
            if link:
                link.last_message_at = datetime.datetime.utcnow()
                db.commit()
        except Exception as exc:  # pragma: no cover - telemetry only
            logger.debug("Failed to update link activity timestamp: %s", exc)
            db.rollback()

    @staticmethod
    def list_links(
        db: Session, organization_id: uuid.UUID, channel: Optional[str] = None
    ):
        """Lists active links for a workspace. Always workspace-scoped."""
        query = db.query(ChannelLink).filter(
            ChannelLink.organization_id == organization_id,
            ChannelLink.status == "active",
        )
        if channel:
            query = query.filter(ChannelLink.channel == channel)
        return query.order_by(ChannelLink.created_at.desc()).all()

    @staticmethod
    def revoke(
        db: Session, organization_id: uuid.UUID, channel: str
    ) -> int:
        """
        Revokes every active link of a channel for a workspace.
        Scoped by organization_id so one tenant can never unlink another's bot.
        """
        now = datetime.datetime.utcnow()
        revoked = (
            db.query(ChannelLink)
            .filter(
                ChannelLink.organization_id == organization_id,
                ChannelLink.channel == channel,
                ChannelLink.status == "active",
            )
            .update(
                {ChannelLink.status: "revoked", ChannelLink.revoked_at: now},
                synchronize_session=False,
            )
        )
        db.commit()
        logger.info("Revoked %d %s link(s) for workspace %s", revoked, channel, organization_id)
        return revoked
