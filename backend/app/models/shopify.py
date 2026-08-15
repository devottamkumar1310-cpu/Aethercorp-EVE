# ==============================================================================
# PURPOSE: Database models backing the Shopify store integration.
# DATA FLOW: OAuth callback writes ShopifyConnection -> sync jobs and webhooks read it ->
#            ShopifyProductMapping links external variant ids to EVE Product rows.
# EXTENSION POINTS: Add fulfilment/location models if EVE starts reasoning per-warehouse.
# ARCHITECTURAL DECISION:
# - Every table carries organization_id so the existing tenant-isolation rules apply
#   unchanged. No Shopify row is ever reachable without an organization filter.
# - Access tokens are stored encrypted (see app/core/crypto.py); the column holds
#   ciphertext, never the raw Shopify token.
# - Mapping lives in its own table rather than as columns on Product. Product is read
#   by every agent and by the startup schema validator; keeping the external identity
#   out of it means the canonical model is untouched by this integration.
# ==============================================================================

import uuid
import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
    Text,
    UUID,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ShopifyConnection(Base):
    """
    One connected Shopify store, owned by exactly one EVE workspace.

    A shop domain may only be connected to a single workspace at a time; the unique
    constraint on shop_domain is what stops a second tenant from installing the app
    on a store another tenant already owns and thereby reading its data.
    """

    __tablename__ = "shopify_connections"

    __table_args__ = (
        UniqueConstraint("shop_domain", name="uq_shopify_connections_shop_domain"),
        Index("ix_shopify_connections_org_status", "organization_id", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The profile that authorised the install. Kept for audit attribution only —
    # authorisation is always evaluated against workspace membership, not this column.
    connected_by_user_id = Column(UUID(as_uuid=True), nullable=True)

    shop_domain = Column(String, nullable=False, index=True)  # e.g. "acme.myshopify.com"
    access_token_encrypted = Column(Text, nullable=False)
    scopes = Column(String, nullable=True)
    api_version = Column(String, nullable=False, default="2024-07")

    # connected | disconnected | error
    status = Column(String, nullable=False, default="connected", index=True)
    last_error = Column(Text, nullable=True)

    # Sync state surfaced directly in the Integrations UI.
    last_sync_at = Column(DateTime, nullable=True)
    last_successful_sync_at = Column(DateTime, nullable=True)
    # idle | running | success | failed
    sync_status = Column(String, nullable=False, default="idle")

    webhook_ids = Column(JSON, nullable=True, default=list)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    organization = relationship("Organization")
    sync_jobs = relationship(
        "ShopifySyncJob", back_populates="connection", cascade="all, delete-orphan"
    )
    product_mappings = relationship(
        "ShopifyProductMapping", back_populates="connection", cascade="all, delete-orphan"
    )


class ShopifySyncJob(Base):
    """
    One synchronisation run (initial backfill, delta refresh, or webhook-triggered).
    Gives the founder a durable answer to "did the last sync work, and what did it do".
    """

    __tablename__ = "shopify_sync_jobs"

    __table_args__ = (
        Index("ix_shopify_sync_jobs_org_started", "organization_id", "started_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopify_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # initial | delta | webhook | reconcile
    job_type = Column(String, nullable=False, default="initial")
    # running | success | failed | partial
    status = Column(String, nullable=False, default="running", index=True)

    products_synced = Column(Integer, nullable=False, default=0)
    variants_synced = Column(Integer, nullable=False, default=0)
    inventory_synced = Column(Integer, nullable=False, default=0)
    orders_synced = Column(Integer, nullable=False, default=0)
    sales_records_synced = Column(Integer, nullable=False, default=0)

    error_message = Column(Text, nullable=True)
    details = Column(JSON, nullable=True, default=dict)

    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)

    connection = relationship("ShopifyConnection", back_populates="sync_jobs")


class ShopifyWebhookEvent(Base):
    """
    Idempotency ledger for inbound Shopify webhooks.

    Shopify retries a webhook until it receives a 2xx, and may deliver the same event
    more than once regardless. The unique webhook_id is the deduplication key: a repeat
    delivery finds an existing row and is acknowledged without reprocessing.
    """

    __tablename__ = "shopify_webhook_events"

    __table_args__ = (
        UniqueConstraint("webhook_id", name="uq_shopify_webhook_events_webhook_id"),
        Index("ix_shopify_webhook_events_org_topic", "organization_id", "topic"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    # Nullable: a webhook for an unknown/disconnected shop is still recorded so that
    # repeated deliveries do not re-run the (rejected) lookup path.
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    webhook_id = Column(String, nullable=False, index=True)  # X-Shopify-Webhook-Id
    topic = Column(String, nullable=False)  # X-Shopify-Topic
    shop_domain = Column(String, nullable=True, index=True)

    # received | processed | ignored | failed
    status = Column(String, nullable=False, default="received")
    error_message = Column(Text, nullable=True)

    received_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)


class ShopifyProductMapping(Base):
    """
    Links a Shopify variant to the EVE Product row that represents it.

    EVE models one variant as one Product (see ShopifyProductMapper), so the variant id
    is the natural key. Holding it here rather than on Product keeps synchronisation
    idempotent — a re-run resolves the existing row instead of inserting a duplicate.
    """

    __tablename__ = "shopify_product_mappings"

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "shopify_variant_id",
            name="uq_shopify_mapping_org_variant",
        ),
        Index(
            "ix_shopify_mapping_org_inventory_item",
            "organization_id",
            "shopify_inventory_item_id",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopify_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    shopify_product_id = Column(String, nullable=False, index=True)
    shopify_variant_id = Column(String, nullable=False, index=True)
    # Shopify addresses stock by inventory_item_id, not by SKU or variant id.
    shopify_inventory_item_id = Column(String, nullable=True, index=True)
    sku = Column(String, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    connection = relationship("ShopifyConnection", back_populates="product_mappings")


class ShopifyOAuthState(Base):
    """
    Single-use OAuth `state` nonce.

    The state value is also HMAC-signed, but a signature alone does not stop replay:
    an attacker who observes one callback URL could re-submit it. Consuming the row on
    first use makes the callback exactly-once.
    """

    __tablename__ = "shopify_oauth_states"

    __table_args__ = (
        UniqueConstraint("state", name="uq_shopify_oauth_states_state"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    state = Column(String, nullable=False, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(UUID(as_uuid=True), nullable=True)
    shop_domain = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
