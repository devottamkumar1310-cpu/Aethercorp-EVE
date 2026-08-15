import datetime
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Numeric,
    String,
    Text,
    UUID,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class StripeCustomer(Base):
    __tablename__ = "stripe_customers"

    __table_args__ = (
        UniqueConstraint("organization_id", name="uq_stripe_customers_organization"),
        UniqueConstraint("stripe_customer_id", name="uq_stripe_customers_customer_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    stripe_customer_id = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    organization = relationship("Organization")


class StripeSubscription(Base):
    __tablename__ = "stripe_subscriptions"

    __table_args__ = (
        UniqueConstraint("stripe_subscription_id", name="uq_stripe_subscriptions_subscription_id"),
        Index("ix_stripe_subscriptions_org_status", "organization_id", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    stripe_customer_id = Column(String, nullable=False, index=True)
    stripe_subscription_id = Column(String, nullable=False, index=True)
    stripe_price_id = Column(String, nullable=True, index=True)

    plan_key = Column(String, nullable=False, default="operator", index=True)
    billing_interval = Column(String, nullable=False, default="month")
    status = Column(String, nullable=False, default="incomplete", index=True)

    amount = Column(Numeric(10, 2), nullable=True)
    currency = Column(String, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    trial_start = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)
    canceled_at = Column(DateTime, nullable=True)
    raw = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    organization = relationship("Organization")


class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"

    __table_args__ = (
        UniqueConstraint("stripe_event_id", name="uq_stripe_webhook_events_event_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    stripe_event_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="received")
    error_message = Column(Text, nullable=True)
    received_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
