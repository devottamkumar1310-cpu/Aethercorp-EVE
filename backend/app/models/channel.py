# ==============================================================================
# PURPOSE: Database models backing EVE's messaging channels (Telegram, WhatsApp).
# DATA FLOW: Founder generates a link code in the UI -> sends it to the bot ->
#            ChannelLink binds the external chat id to (workspace, user) ->
#            every later message resolves the workspace from that link.
# EXTENSION POINTS: Add new channel values (e.g. "slack") — nothing here is
#            Telegram- or WhatsApp-specific beyond the channel discriminator.
# ARCHITECTURAL DECISION:
# - A channel link is the ONLY way an external identifier maps to a workspace.
#   There is no lookup by phone number, username or display name, because those are
#   attacker-supplied and would let an outsider address another tenant's data.
# - External identifiers are stored hashed, not raw: a leaked database row must not
#   expose the founder's phone number or Telegram account.
# ==============================================================================

import uuid
import datetime

from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    UUID,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base

# Channel discriminators used across the messaging layer.
CHANNEL_TELEGRAM = "telegram"
CHANNEL_WHATSAPP = "whatsapp"
SUPPORTED_CHANNELS = (CHANNEL_TELEGRAM, CHANNEL_WHATSAPP)


class ChannelLink(Base):
    """
    Binds one external messaging identity to one EVE workspace and user.
    """

    __tablename__ = "channel_links"

    __table_args__ = (
        # One external identity per channel maps to at most one workspace. This is the
        # constraint that makes cross-tenant addressing impossible: a Telegram account
        # cannot simultaneously resolve to two workspaces.
        UniqueConstraint(
            "channel", "external_id_hash", name="uq_channel_links_channel_external"
        ),
        Index("ix_channel_links_org_channel", "organization_id", "channel"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    channel = Column(String, nullable=False, index=True)
    # SHA-256 of the provider's user/chat identifier. Used for lookup.
    external_id_hash = Column(String, nullable=False, index=True)
    # Where replies are delivered. Telegram chat id / WhatsApp phone number id.
    # Encrypted, because for WhatsApp this IS the founder's phone number.
    delivery_address_encrypted = Column(Text, nullable=False)
    # Non-identifying label for the UI, e.g. "…4821". Never the full identifier.
    display_hint = Column(String, nullable=True)

    # active | revoked
    status = Column(String, nullable=False, default="active", index=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    last_message_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    organization = relationship("Organization")


class ChannelLinkCode(Base):
    """
    Short-lived, single-use code that proves the person messaging the bot is the
    authenticated founder. Issued from the dashboard, redeemed in the chat.
    """

    __tablename__ = "channel_link_codes"

    __table_args__ = (
        UniqueConstraint("code", name="uq_channel_link_codes_code"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    code = Column(String, nullable=False, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Restricts a code to the channel it was issued for, so a Telegram code cannot be
    # redeemed over WhatsApp.
    channel = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)


class ChannelMessageEvent(Base):
    """
    Idempotency ledger for inbound channel messages.

    Telegram redelivers an update until the webhook returns 200; WhatsApp retries on
    any non-2xx. Recording the provider's message identifier means a retry is
    acknowledged rather than answered twice (and billed twice).
    """

    __tablename__ = "channel_message_events"

    __table_args__ = (
        UniqueConstraint(
            "channel", "external_event_id", name="uq_channel_message_events_channel_event"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    channel = Column(String, nullable=False, index=True)
    external_event_id = Column(String, nullable=False, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # received | processed | ignored | failed
    status = Column(String, nullable=False, default="received")
    error_message = Column(Text, nullable=True)

    received_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
