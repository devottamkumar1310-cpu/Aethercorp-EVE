from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class PlanLimitExceeded(Exception):
    """Raised by service-layer enforcement when a workspace exceeds its plan."""

    def __init__(self, message: str, code: str = "PLAN_LIMIT_EXCEEDED"):
        super().__init__(message)
        self.message = message
        self.code = code


class BillingRequired(Exception):
    """Raised when a workspace no longer has an active trial/subscription."""

    def __init__(self, message: str = "An active EVE subscription is required."):
        super().__init__(message)
        self.message = message


@dataclass(frozen=True)
class PlanDefinition:
    key: str
    name: str
    monthly_price: int
    annual_price: int
    max_shopify_stores: int
    max_skus: Optional[int]
    ai_interactions_per_month: Optional[int]
    telegram: bool
    whatsapp: bool
    proactive_alerts: bool
    hourly_sync: bool
    support_level: str
    features: tuple[str, ...]


PLANS: dict[str, PlanDefinition] = {
    "operator": PlanDefinition(
        key="operator",
        name="Operator",
        monthly_price=49,
        annual_price=490,
        max_shopify_stores=1,
        max_skus=500,
        ai_interactions_per_month=None,
        telegram=True,
        whatsapp=False,
        proactive_alerts=False,
        hourly_sync=False,
        support_level="standard",
        features=(
            "1 Shopify store",
            "500 SKU limit",
            "Inventory Intelligence",
            "Dashboard",
            "AI Assistant",
            "Decision Traceability",
            "Telegram",
            "Core proactive insights",
            "Standard synchronization",
        ),
    ),
    "command": PlanDefinition(
        key="command",
        name="Command",
        monthly_price=149,
        annual_price=1490,
        max_shopify_stores=3,
        max_skus=3000,
        ai_interactions_per_month=None,
        telegram=True,
        whatsapp=True,
        proactive_alerts=True,
        hourly_sync=True,
        support_level="priority",
        features=(
            "Up to 3 Shopify stores",
            "3,000 SKU limit",
            "WhatsApp",
            "Hourly synchronization",
            "Proactive alerts",
            "Higher AI allowance",
            "Advanced intelligence",
            "Priority support",
        ),
    ),
    "chief": PlanDefinition(
        key="chief",
        name="Chief",
        monthly_price=399,
        annual_price=3990,
        max_shopify_stores=3,
        max_skus=None,
        ai_interactions_per_month=2000,
        telegram=True,
        whatsapp=True,
        proactive_alerts=True,
        hourly_sync=True,
        support_level="highest",
        features=(
            "Up to 3 Shopify stores",
            "Unlimited SKUs",
            "2,000 AI interactions/month internal guardrail",
            "Advanced intelligence",
            "Audit capabilities",
            "Onboarding call",
            "Highest support level",
        ),
    ),
}


PLAN_ALIASES = {
    "starter": "operator",
    "free": "operator",
    "trial": "operator",
    "basic": "operator",
    "operator": "operator",
    "pro": "command",
    "growth": "command",
    "command": "command",
    "premium": "chief",
    "enterprise": "chief",
    "chief": "chief",
}

ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing", "past_due"}


def normalize_plan_key(value: Optional[str]) -> str:
    return PLAN_ALIASES.get((value or "").strip().lower(), "operator")


def plan_by_key(value: Optional[str]) -> PlanDefinition:
    return PLANS[normalize_plan_key(value)]


def _owner_profile(db: Session, organization_id: uuid.UUID):
    from app.models.organization import Membership
    from app.models.profile import Profile

    return (
        db.query(Profile)
        .join(Membership, Membership.user_id == Profile.id)
        .filter(Membership.organization_id == organization_id)
        .order_by(Membership.role.desc())
        .first()
    )


def active_subscription_for_workspace(db: Session, organization_id: uuid.UUID):
    from app.models.billing import StripeSubscription

    return (
        db.query(StripeSubscription)
        .filter(
            StripeSubscription.organization_id == organization_id,
            StripeSubscription.status.in_(ACTIVE_SUBSCRIPTION_STATUSES),
        )
        .order_by(StripeSubscription.updated_at.desc())
        .first()
    )


def _workspace_has_any_subscription_record(db: Session, organization_id: uuid.UUID) -> bool:
    """True if Stripe has ever created a subscription row for this workspace,
    regardless of its current status. Used to keep a canceled subscriber from
    falling back into the pre-Stripe trial grant: Profile.trial_end_date is a
    stale cache from signup and is never updated on cancellation, so without
    this check a canceled paying customer would silently regain Operator
    access for the rest of their original trial window."""
    from app.models.billing import StripeSubscription

    return (
        db.query(StripeSubscription.id)
        .filter(StripeSubscription.organization_id == organization_id)
        .first()
        is not None
    )


def entitlement_for_workspace(db: Session, organization_id: uuid.UUID) -> dict:
    """
    Returns the server-side entitlement state.

    Stripe subscription state wins. During the 14-day trial before Stripe exists,
    Profile.trial_end_date grants Operator capabilities. An expired trial with no
    active Stripe subscription is inactive; there is no permanent free tier.
    """
    subscription = active_subscription_for_workspace(db, organization_id)
    if subscription:
        plan = plan_by_key(subscription.plan_key)
        return {
            "active": True,
            "source": "stripe",
            "status": subscription.status,
            "plan": plan,
            "subscription": subscription,
            "trial_ends_at": subscription.trial_end,
            "current_period_end": subscription.current_period_end,
        }

    owner = _owner_profile(db, organization_id)
    now = datetime.datetime.utcnow()
    if owner and owner.subscription_status == "founder":
        return {
            "active": True,
            "source": "founder",
            "status": "active",
            "plan": PLANS["chief"],
            "subscription": None,
            "trial_ends_at": None,
            "current_period_end": None,
        }
    from app.database import as_naive_utc

    trial_end = as_naive_utc(owner.trial_end_date) if owner else None
    if (
        owner
        and owner.subscription_status == "trial"
        and trial_end
        and trial_end > now
        and not _workspace_has_any_subscription_record(db, organization_id)
    ):
        return {
            "active": True,
            "source": "trial",
            "status": "trialing",
            "plan": PLANS["operator"],
            "subscription": None,
            "trial_ends_at": owner.trial_end_date,
            "current_period_end": owner.trial_end_date,
        }

    cached_plan = plan_by_key(owner.plan_type if owner else None)
    return {
        "active": False,
        "source": "none",
        "status": "inactive",
        "plan": cached_plan,
        "subscription": None,
        "trial_ends_at": owner.trial_end_date if owner else None,
        "current_period_end": None,
    }


def ensure_workspace_entitled(db: Session, organization_id: uuid.UUID) -> dict:
    entitlement = entitlement_for_workspace(db, organization_id)
    if not entitlement["active"]:
        raise BillingRequired()
    return entitlement


def http_plan_error(exc: Exception) -> HTTPException:
    if isinstance(exc, BillingRequired):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=exc.message)
    if isinstance(exc, PlanLimitExceeded):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=exc.message)
    return HTTPException(status_code=500, detail="Plan enforcement failed.")


def require_capability(db: Session, organization_id: uuid.UUID, capability: str) -> PlanDefinition:
    entitlement = ensure_workspace_entitled(db, organization_id)
    plan: PlanDefinition = entitlement["plan"]
    allowed = bool(getattr(plan, capability, False))
    if not allowed:
        raise PlanLimitExceeded(f"{capability.replace('_', ' ').title()} requires a higher EVE plan.")
    return plan


def enforce_shopify_store_limit(db: Session, organization_id: uuid.UUID, adding: int = 1) -> None:
    from app.models.shopify import ShopifyConnection

    plan = ensure_workspace_entitled(db, organization_id)["plan"]
    connected = (
        db.query(ShopifyConnection)
        .filter(
            ShopifyConnection.organization_id == organization_id,
            ShopifyConnection.status != "disconnected",
        )
        .count()
    )
    if connected + adding > plan.max_shopify_stores:
        raise PlanLimitExceeded(
            f"{plan.name} includes {plan.max_shopify_stores} Shopify store"
            f"{'' if plan.max_shopify_stores == 1 else 's'}. Upgrade to connect more stores."
        )


def enforce_sku_limit(db: Session, organization_id: uuid.UUID, resulting_skus: int) -> None:
    plan = ensure_workspace_entitled(db, organization_id)["plan"]
    if plan.max_skus is not None and resulting_skus > plan.max_skus:
        raise PlanLimitExceeded(
            f"{plan.name} includes up to {plan.max_skus:,} SKUs. "
            "Upgrade before syncing a larger catalogue."
        )


def serialize_plan(plan: PlanDefinition) -> dict:
    return {
        "key": plan.key,
        "name": plan.name,
        "monthly_price": plan.monthly_price,
        "annual_price": plan.annual_price,
        "annual_savings": plan.monthly_price * 12 - plan.annual_price,
        "max_shopify_stores": plan.max_shopify_stores,
        "max_skus": plan.max_skus,
        "ai_interactions_per_month": plan.ai_interactions_per_month,
        "telegram": plan.telegram,
        "whatsapp": plan.whatsapp,
        "proactive_alerts": plan.proactive_alerts,
        "hourly_sync": plan.hourly_sync,
        "support_level": plan.support_level,
        "features": list(plan.features),
    }
