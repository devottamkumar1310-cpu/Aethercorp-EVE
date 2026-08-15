# ==============================================================================
# PURPOSE: Stripe integration — the billing source of truth for EVE plans.
# DATA FLOW: Dashboard -> checkout session -> Stripe Checkout -> webhook ->
#            StripeSubscription (source of truth) -> app.core.plans.entitlement_for_workspace.
# EXTENSION POINTS: Add a plan by adding it to app.core.plans.PLANS and wiring
#            two new STRIPE_PRICE_* settings; nothing else here changes.
# ARCHITECTURAL DECISION:
# - Stripe is the ONLY source of subscription truth. This module never accepts a
#   plan, price, or status from the caller — checkout resolves a price id from a
#   server-side plan_key+interval, and every status change is read back from a
#   signature-verified webhook payload, never from the client that triggered it.
# - Workspace resolution for webhooks goes through OUR stripe_customers table
#   (stripe_customer_id -> organization_id), not through Stripe object metadata.
#   Metadata is also set, as a fallback, but the FK table is authoritative:
#   it is written by our own server at Customer-creation time, before any
#   webhook can reference it.
# - Cancellation NEVER deletes a workspace or its data. Only the subscription
#   row's status changes; Product/InventoryItem/SalesRecord/RecommendationTrace
#   are untouched, matching the same principle already applied to Shopify
#   disconnect (see integrations_shopify.py).
# ==============================================================================

import datetime
import logging
import uuid
from typing import Any, Dict, Optional, Tuple

import stripe
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.billing import StripeCustomer, StripeSubscription, StripeWebhookEvent
from app.models.profile import Profile

logger = logging.getLogger("eve.services.billing.stripe_service")

# Statuses Stripe uses that we recognise. Anything else lands as "unknown" in
# our row rather than raising, because Stripe adds statuses over time and a
# webhook must never hard-fail on one we haven't seen yet.
KNOWN_STATUSES = {
    "trialing", "active", "past_due", "canceled", "unpaid",
    "incomplete", "incomplete_expired", "paused",
}


class StripeError(Exception):
    """Raised for a Stripe-related failure the caller must surface."""


def is_configured() -> bool:
    """True when this deployment has a Stripe secret key configured."""
    return bool(settings.STRIPE_SECRET_KEY)


def _client() -> "stripe.StripeClient":
    if not is_configured():
        raise StripeError("Stripe is not configured on this EVE deployment.")
    return stripe.StripeClient(settings.STRIPE_SECRET_KEY)


# ---------------------------------------------------------------- price map

def _price_map() -> Dict[Tuple[str, str], str]:
    """(plan_key, interval) -> Stripe price id, built from configured settings."""
    return {
        ("operator", "month"): settings.STRIPE_PRICE_OPERATOR_MONTHLY,
        ("operator", "year"): settings.STRIPE_PRICE_OPERATOR_ANNUAL,
        ("command", "month"): settings.STRIPE_PRICE_COMMAND_MONTHLY,
        ("command", "year"): settings.STRIPE_PRICE_COMMAND_ANNUAL,
        ("chief", "month"): settings.STRIPE_PRICE_CHIEF_MONTHLY,
        ("chief", "year"): settings.STRIPE_PRICE_CHIEF_ANNUAL,
    }


def resolve_price_id(plan_key: str, interval: str) -> str:
    """
    Resolves a server-known (plan, interval) pair to a Stripe price id.

    The caller supplies plan_key/interval; the price id itself is never taken
    from the client, so a request cannot name an arbitrary Stripe price.
    """
    price_id = _price_map().get((plan_key, interval), "")
    if not price_id:
        raise StripeError(
            f"No Stripe price configured for plan={plan_key} interval={interval}."
        )
    return price_id


def plan_and_interval_for_price(price_id: str) -> Tuple[str, str]:
    """Reverse lookup: Stripe price id -> (plan_key, interval). Used on webhooks."""
    for (plan_key, interval), configured_id in _price_map().items():
        if configured_id and configured_id == price_id:
            return plan_key, interval
    # An unrecognised price must not silently grant a plan. Default to the
    # cheapest plan rather than raising, so a webhook for a manually-created
    # Stripe price does not crash the handler.
    logger.warning("Unrecognised Stripe price id %s; defaulting to operator/month.", price_id)
    return "operator", "month"


# --------------------------------------------------------------- customers

def get_or_create_customer(
    db: Session, organization_id: uuid.UUID, user: Profile
) -> StripeCustomer:
    """
    Returns the workspace's Stripe Customer, creating one if needed.

    One Customer per workspace (not per user): billing is a workspace-level
    concern, matching every other tenant-scoped resource in EVE.
    """
    existing = (
        db.query(StripeCustomer)
        .filter(StripeCustomer.organization_id == organization_id)
        .first()
    )
    if existing:
        return existing

    client = _client()
    customer = client.v1.customers.create(
        params={
            "email": user.email,
            "name": user.full_name or user.email,
            "metadata": {"organization_id": str(organization_id), "user_id": str(user.id)},
        }
    )

    record = StripeCustomer(
        organization_id=organization_id,
        user_id=user.id,
        stripe_customer_id=customer.id,
        email=user.email,
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info("Created Stripe customer for workspace %s.", organization_id)
    return record


def _workspace_has_ever_subscribed(db: Session, organization_id: uuid.UUID) -> bool:
    """
    True if any subscription row (active, canceled, or otherwise) already
    exists for this workspace. Gates trial eligibility: a workspace that
    cancels and re-subscribes does not get a second free trial.
    """
    return (
        db.query(StripeSubscription)
        .filter(StripeSubscription.organization_id == organization_id)
        .first()
        is not None
    )


# ---------------------------------------------------------------- checkout

def create_checkout_session(
    db: Session,
    organization_id: uuid.UUID,
    user: Profile,
    plan_key: str,
    interval: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """
    Creates a Stripe Checkout session for a subscription and returns its URL.

    plan_key/interval are validated against app.core.plans.PLANS by the route
    before this is called, so only a real plan/interval combination reaches
    resolve_price_id.
    """
    from app.core.plans import normalize_plan_key

    if plan_key != normalize_plan_key(plan_key):
        raise StripeError(f"Unknown plan: {plan_key}")
    if interval not in ("month", "year"):
        raise StripeError(f"Unknown billing interval: {interval}")

    price_id = resolve_price_id(plan_key, interval)
    customer = get_or_create_customer(db, organization_id, user)

    subscription_data: Dict[str, Any] = {
        "metadata": {"organization_id": str(organization_id), "plan_key": plan_key},
    }
    if not _workspace_has_ever_subscribed(db, organization_id):
        subscription_data["trial_period_days"] = settings.STRIPE_TRIAL_DAYS

    client = _client()
    session = client.v1.checkout.sessions.create(
        params={
            "mode": "subscription",
            "customer": customer.stripe_customer_id,
            "client_reference_id": str(organization_id),
            "line_items": [{"price": price_id, "quantity": 1}],
            "subscription_data": subscription_data,
            "success_url": success_url,
            "cancel_url": cancel_url,
            "allow_promotion_codes": True,
        }
    )
    logger.info(
        "Created Checkout session for workspace %s (plan=%s interval=%s).",
        organization_id, plan_key, interval,
    )
    return session.url


def create_portal_session(
    db: Session, organization_id: uuid.UUID, return_url: str
) -> str:
    """
    Creates a Stripe Billing Portal session. The portal itself handles plan
    switches, payment method updates and cancellation — we do not build a
    parallel UI for those; the webhook is what learns the outcome.
    """
    customer = (
        db.query(StripeCustomer)
        .filter(StripeCustomer.organization_id == organization_id)
        .first()
    )
    if not customer:
        raise StripeError("No billing account exists for this workspace yet.")

    client = _client()
    session = client.v1.billing_portal.sessions.create(
        params={"customer": customer.stripe_customer_id, "return_url": return_url}
    )
    return session.url


# ----------------------------------------------------------------- webhook

def verify_and_parse_event(payload: bytes, signature: Optional[str]) -> "stripe.Event":
    """
    Verifies the Stripe-Signature header over the RAW body and returns the event.

    Raises stripe.error.SignatureVerificationError on failure — the route
    catches this and answers 400, never proceeding to touch a subscription.
    """
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise StripeError("Stripe webhook secret is not configured.")
    return stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )


def claim_webhook_event(db: Session, event_id: str, event_type: str) -> Optional[StripeWebhookEvent]:
    """
    Claims a webhook delivery for processing via a unique-constraint race.

    Stripe retries undelivered (non-2xx) webhooks and can also send genuine
    duplicates; the DB constraint — not a prior SELECT — is what makes a
    concurrent duplicate delivery resolve to exactly one winner.
    """
    record = StripeWebhookEvent(
        stripe_event_id=event_id,
        event_type=event_type,
        status="received",
        received_at=datetime.datetime.utcnow(),
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.info("Duplicate Stripe webhook event %s ignored.", event_id)
        return None
    db.refresh(record)
    return record


def close_webhook_event(
    db: Session, record: StripeWebhookEvent, status: str, error: Optional[str] = None
) -> None:
    try:
        record.status = status
        record.error_message = error[:500] if error else None
        record.processed_at = datetime.datetime.utcnow()
        db.commit()
    except Exception as exc:  # pragma: no cover - bookkeeping only
        logger.warning("Failed to close Stripe webhook event: %s", exc)
        db.rollback()


def _resolve_organization_for_customer(
    db: Session, stripe_customer_id: str, fallback_metadata: Optional[Dict[str, Any]] = None
) -> Optional[uuid.UUID]:
    """
    Resolves the workspace for a Stripe object.

    Primary path: our own stripe_customers table, keyed on the customer id —
    authoritative because WE wrote it, before any webhook could reference it.
    Fallback: metadata we set at creation time, only used if the customer
    record is somehow missing (e.g. a manual Stripe Dashboard action).
    """
    customer = (
        db.query(StripeCustomer)
        .filter(StripeCustomer.stripe_customer_id == stripe_customer_id)
        .first()
    )
    if customer:
        return customer.organization_id

    if fallback_metadata:
        raw = fallback_metadata.get("organization_id")
        if raw:
            try:
                return uuid.UUID(raw)
            except ValueError:
                pass
    return None


def _upsert_subscription_from_object(db: Session, sub_obj: Dict[str, Any]) -> bool:
    """
    Writes a Stripe Subscription object onto our StripeSubscription row.
    Returns True if applied, False if the workspace could not be resolved
    (logged, never raised — an unresolvable subscription must not crash the
    webhook handler and cause Stripe to retry forever).
    """
    customer_id = sub_obj.get("customer")
    if isinstance(customer_id, dict):
        customer_id = customer_id.get("id")

    org_id = _resolve_organization_for_customer(
        db, customer_id, fallback_metadata=sub_obj.get("metadata")
    )
    if not org_id:
        logger.error(
            "Cannot resolve workspace for Stripe subscription %s (customer %s).",
            sub_obj.get("id"), customer_id,
        )
        return False

    items = (sub_obj.get("items") or {}).get("data") or []
    price_id = ""
    if items:
        price = items[0].get("price") or {}
        price_id = price.get("id", "")
    plan_key, interval = plan_and_interval_for_price(price_id) if price_id else ("operator", "month")

    status = sub_obj.get("status") or "incomplete"
    if status not in KNOWN_STATUSES:
        logger.warning("Unrecognised Stripe subscription status %r.", status)

    def _ts(value) -> Optional[datetime.datetime]:
        return datetime.datetime.utcfromtimestamp(value) if value else None

    existing = (
        db.query(StripeSubscription)
        .filter(StripeSubscription.stripe_subscription_id == sub_obj.get("id"))
        .first()
    )
    if not existing:
        existing = StripeSubscription(
            organization_id=org_id,
            stripe_subscription_id=sub_obj.get("id"),
            created_at=datetime.datetime.utcnow(),
        )
        db.add(existing)

    price_amount = None
    if items:
        unit_amount = (items[0].get("price") or {}).get("unit_amount")
        price_amount = (unit_amount / 100.0) if unit_amount is not None else None

    existing.organization_id = org_id
    existing.stripe_customer_id = customer_id
    existing.stripe_price_id = price_id or None
    existing.plan_key = plan_key
    existing.billing_interval = interval
    existing.status = status
    existing.amount = price_amount
    existing.currency = sub_obj.get("currency")
    existing.cancel_at_period_end = bool(sub_obj.get("cancel_at_period_end"))
    existing.current_period_start = _ts(sub_obj.get("current_period_start"))
    existing.current_period_end = _ts(sub_obj.get("current_period_end"))
    existing.trial_start = _ts(sub_obj.get("trial_start"))
    existing.trial_end = _ts(sub_obj.get("trial_end"))
    existing.canceled_at = _ts(sub_obj.get("canceled_at"))
    existing.raw = {
        "id": sub_obj.get("id"),
        "status": status,
        "current_period_end": sub_obj.get("current_period_end"),
    }  # Deliberately NOT the full object: it can contain the customer's PII
       # (name, address) and there is no product need to retain that here.
    existing.updated_at = datetime.datetime.utcnow()

    db.commit()
    logger.info(
        "Upserted Stripe subscription %s for workspace %s: status=%s plan=%s.",
        sub_obj.get("id"), org_id, status, plan_key,
    )
    return True


def _as_plain_dict(obj: Any) -> Dict[str, Any]:
    """
    Normalises a Stripe SDK object to a plain dict.

    stripe.Webhook.construct_event() returns a stripe.Event whose nested
    data.object is a stripe.StripeObject, not a dict — it supports obj["key"]
    and obj.key, but NOT obj.get("key"). Every handler below is written
    against a plain dict (matching how the rest of EVE's webhook handlers —
    Shopify, WhatsApp — already work), so any object crossing the SDK
    boundary is converted exactly once, here, rather than rewriting every
    .get() call site to a dual dict/StripeObject-safe form.
    """
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    return obj


def handle_event(db: Session, event: "stripe.Event") -> str:
    """
    Applies one verified Stripe event. Returns a short outcome label.

    Only subscription-lifecycle events change state; everything else (e.g.
    invoice line-item events, payment-method events) is acknowledged and
    ignored — narrow handling means a webhook subscribed to "all events" in
    the Stripe Dashboard cannot surprise this code with an unhandled shape.
    """
    event_type = event["type"]
    data_object = _as_plain_dict(event["data"]["object"])

    if event_type == "checkout.session.completed":
        # The Subscription object itself carries the authoritative state;
        # Checkout completing is the trigger to go fetch it, not a state to
        # store by itself.
        subscription_id = data_object.get("subscription")
        if not subscription_id:
            return "ignored_no_subscription"
        client = _client()
        sub_obj = _as_plain_dict(client.v1.subscriptions.retrieve(subscription_id))
        applied = _upsert_subscription_from_object(db, sub_obj)
        return "subscription_created" if applied else "unresolved_workspace"

    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        applied = _upsert_subscription_from_object(db, data_object)
        return "subscription_upserted" if applied else "unresolved_workspace"

    if event_type == "customer.subscription.deleted":
        sub = (
            db.query(StripeSubscription)
            .filter(StripeSubscription.stripe_subscription_id == data_object.get("id"))
            .first()
        )
        if not sub:
            return "ignored_unknown_subscription"
        sub.status = "canceled"
        sub.canceled_at = datetime.datetime.utcnow()
        sub.updated_at = datetime.datetime.utcnow()
        db.commit()
        logger.info("Stripe subscription %s canceled for workspace %s.", sub.stripe_subscription_id, sub.organization_id)
        return "subscription_canceled"

    if event_type == "invoice.payment_failed":
        # No status write here: Stripe follows this with customer.subscription
        # .updated carrying the new status (past_due, then eventually
        # unpaid/canceled per the account's dunning settings). past_due is in
        # ACTIVE_SUBSCRIPTION_STATUSES, so the workspace is not cut off
        # immediately — the customer gets Stripe's own retry/dunning grace
        # period, exactly like a normal SaaS. This handler just alerts.
        try:
            from app.services.alert_service import AlertService

            AlertService._dispatch_alert(
                "stripe_payment_failed",
                f"Invoice payment failed for Stripe customer {data_object.get('customer')}.",
                {"invoice_id": data_object.get("id")},
            )
        except Exception:  # pragma: no cover - telemetry must never block
            pass
        return "payment_failure_noted"

    return "ignored"
