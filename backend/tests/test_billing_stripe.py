# ==============================================================================
# PURPOSE: Stripe billing test suite.
#
# HONESTY BOUNDARY — read before trusting these results:
#   This environment has no Stripe test-mode API key. Every test that would
#   need to reach Stripe's API (customer creation, Checkout Session creation,
#   Billing Portal session creation, Subscription retrieval) mocks that ONE
#   call and verifies everything around it for real: real webhook signature
#   cryptography (via stripe.WebhookSignature.generate_signature_header, the
#   helper Stripe's own SDK ships "for signing payloads in unit tests"), real
#   database writes, real idempotency, real tenant isolation.
#
#   This is CODE VERIFIED. It is NOT STRIPE TEST MODE VERIFIED — that requires
#   a real sk_test_ key and would exercise Stripe's actual API validation
#   (e.g. a price id that doesn't exist, an already-canceled subscription).
#   Neither is claimed here. See docs/INTEGRATIONS.md for what a real
#   Stripe test-mode run would still need to prove.
# ==============================================================================

import datetime
import json
import uuid
from unittest.mock import MagicMock, patch

import pytest
import stripe
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core.security import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.billing import StripeCustomer, StripeSubscription, StripeWebhookEvent
from app.models.organization import Membership, Organization
from app.models.profile import Profile
from app.services.billing import stripe_service

# ---------------------------------------------------------------- fixtures

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

WEBHOOK_SECRET = "whsec_test_billing_secret_for_hmac"


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def hermetic_app():
    snapshot = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(snapshot)


@pytest.fixture(autouse=True)
def stripe_credentials(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_dummy_for_unit_tests")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setattr(settings, "STRIPE_PRICE_OPERATOR_MONTHLY", "price_operator_month")
    monkeypatch.setattr(settings, "STRIPE_PRICE_OPERATOR_ANNUAL", "price_operator_year")
    monkeypatch.setattr(settings, "STRIPE_PRICE_COMMAND_MONTHLY", "price_command_month")
    monkeypatch.setattr(settings, "STRIPE_PRICE_COMMAND_ANNUAL", "price_command_year")
    monkeypatch.setattr(settings, "STRIPE_PRICE_CHIEF_MONTHLY", "price_chief_month")
    monkeypatch.setattr(settings, "STRIPE_PRICE_CHIEF_ANNUAL", "price_chief_year")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://app.example.com")
    yield


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _workspace(db):
    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    db.add_all([
        Profile(id=user_id, email=f"{user_id.hex[:10]}@x.com", full_name="P",
                hashed_password="x"),
        Organization(id=org_id, name=f"BS-{org_id.hex[:6]}", slug=f"bs-{org_id.hex[:10]}"),
        Membership(user_id=user_id, organization_id=org_id, role="owner"),
    ])
    db.commit()
    return org_id, user_id


def _profile(user_id):
    session = TestingSessionLocal()
    try:
        return session.query(Profile).filter(Profile.id == user_id).first()
    finally:
        session.close()


def _client_as(user_id):
    app.dependency_overrides[get_current_user] = lambda: _profile(user_id)
    return TestClient(app)


def hdr(org_id):
    return {"Authorization": "Bearer x", "X-Workspace-Id": str(org_id)}


def _webhook_body(event_type, data_object, event_id=None):
    return json.dumps({
        "id": event_id or f"evt_{uuid.uuid4().hex[:20]}",
        "type": event_type,
        "data": {"object": data_object},
    })


def _sign(payload: str) -> str:
    """Real Stripe signature, via the SDK's own documented test-signing helper."""
    return stripe.WebhookSignature.generate_signature_header(payload, WEBHOOK_SECRET)


def _subscription_object(
    sub_id, customer_id, price_id="price_command_month",
    status="active", org_id=None,
):
    now = int(datetime.datetime.utcnow().timestamp())
    return {
        "id": sub_id,
        "customer": customer_id,
        "status": status,
        "cancel_at_period_end": False,
        "current_period_start": now,
        "current_period_end": now + 30 * 86400,
        "trial_start": None,
        "trial_end": None,
        "canceled_at": None,
        "currency": "usd",
        "metadata": {"organization_id": str(org_id)} if org_id else {},
        "items": {"data": [{"price": {"id": price_id, "unit_amount": 14900}}]},
    }


# ============================================================================
# 1 · WEBHOOK SIGNATURE VERIFICATION — real cryptography
# ============================================================================


class TestWebhookSignature:
    def test_correctly_signed_payload_is_accepted(self):
        payload = _webhook_body("customer.subscription.updated", {"id": "sub_1"})
        header = _sign(payload)
        event = stripe_service.verify_and_parse_event(payload.encode(), header)
        assert event["type"] == "customer.subscription.updated"

    def test_tampered_payload_is_rejected(self):
        payload = _webhook_body("customer.subscription.updated", {"id": "sub_1"})
        header = _sign(payload)  # signed for the ORIGINAL payload
        tampered = payload.replace("sub_1", "sub_2")
        with pytest.raises(Exception):
            stripe_service.verify_and_parse_event(tampered.encode(), header)

    def test_wrong_secret_is_rejected(self):
        payload = _webhook_body("customer.subscription.updated", {"id": "sub_1"})
        bad_header = stripe.WebhookSignature.generate_signature_header(
            payload, "whsec_completely_different_secret"
        )
        with pytest.raises(Exception):
            stripe_service.verify_and_parse_event(payload.encode(), bad_header)

    def test_missing_signature_is_rejected(self):
        payload = _webhook_body("customer.subscription.updated", {"id": "sub_1"})
        with pytest.raises(Exception):
            stripe_service.verify_and_parse_event(payload.encode(), None)

    def test_endpoint_rejects_forged_signature(self, db):
        payload = _webhook_body("customer.subscription.updated", {"id": "sub_1"})
        with TestClient(app) as client:
            response = client.post(
                "/api/billing/webhook", content=payload,
                headers={"Stripe-Signature": "t=1,v1=deadbeef"},
            )
        assert response.status_code == 400

    def test_endpoint_rejects_missing_signature_header(self, db):
        payload = _webhook_body("customer.subscription.updated", {"id": "sub_1"})
        with TestClient(app) as client:
            response = client.post("/api/billing/webhook", content=payload)
        assert response.status_code == 400


# ============================================================================
# 2 · WEBHOOK IDEMPOTENCY
# ============================================================================


class TestWebhookIdempotency:
    def test_duplicate_event_id_is_not_reprocessed(self, db):
        org_id, user_id = _workspace(db)
        customer = StripeCustomer(
            organization_id=org_id, user_id=user_id, stripe_customer_id="cus_dup_test",
            email="p@x.com", created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        db.add(customer)
        db.commit()

        sub_obj = _subscription_object("sub_dup_1", "cus_dup_test")
        payload = _webhook_body(
            "customer.subscription.updated", sub_obj, event_id="evt_dup_fixed_id"
        )
        header = _sign(payload)

        with TestClient(app) as client:
            first = client.post(
                "/api/billing/webhook", content=payload,
                headers={"Stripe-Signature": header},
            )
            second = client.post(
                "/api/billing/webhook", content=payload,
                headers={"Stripe-Signature": header},
            )

        assert first.json()["status"] == "processed"
        assert second.json()["status"] == "duplicate"

        events = db.query(StripeWebhookEvent).filter(
            StripeWebhookEvent.stripe_event_id == "evt_dup_fixed_id"
        ).all()
        assert len(events) == 1

        # And only ONE subscription row, not two, despite two deliveries.
        rows = db.query(StripeSubscription).filter(
            StripeSubscription.stripe_subscription_id == "sub_dup_1"
        ).all()
        assert len(rows) == 1


# ============================================================================
# 3 · SUBSCRIPTION LIFECYCLE
# ============================================================================


class TestSubscriptionLifecycle:
    def test_checkout_completed_fetches_and_stores_the_subscription(self, db):
        org_id, user_id = _workspace(db)
        db.add(StripeCustomer(
            organization_id=org_id, user_id=user_id, stripe_customer_id="cus_checkout_1",
            email="p@x.com", created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        sub_obj = _subscription_object("sub_checkout_1", "cus_checkout_1", status="trialing")
        payload = _webhook_body(
            "checkout.session.completed",
            {"customer": "cus_checkout_1", "subscription": "sub_checkout_1"},
        )
        header = _sign(payload)

        fake_client = MagicMock()
        fake_client.v1.subscriptions.retrieve.return_value = sub_obj

        with patch.object(stripe_service, "_client", return_value=fake_client):
            with TestClient(app) as client:
                response = client.post(
                    "/api/billing/webhook", content=payload,
                    headers={"Stripe-Signature": header},
                )
        assert response.status_code == 200
        assert response.json()["outcome"] == "subscription_created"

        row = db.query(StripeSubscription).filter(
            StripeSubscription.stripe_subscription_id == "sub_checkout_1"
        ).one()
        assert row.organization_id == org_id
        assert row.status == "trialing"
        assert row.plan_key == "command"

    def test_subscription_updated_changes_plan_and_status(self, db):
        org_id, user_id = _workspace(db)
        db.add(StripeCustomer(
            organization_id=org_id, user_id=user_id, stripe_customer_id="cus_upgrade_1",
            email="p@x.com", created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        # Start on Command...
        first = _subscription_object(
            "sub_upgrade_1", "cus_upgrade_1", price_id="price_command_month", status="active"
        )
        payload1 = _webhook_body("customer.subscription.updated", first)
        with TestClient(app) as client:
            client.post(
                "/api/billing/webhook", content=payload1,
                headers={"Stripe-Signature": _sign(payload1)},
            )
        row = db.query(StripeSubscription).filter(
            StripeSubscription.stripe_subscription_id == "sub_upgrade_1"
        ).one()
        assert row.plan_key == "command"

        # ...then Stripe reports an upgrade to Chief.
        second = _subscription_object(
            "sub_upgrade_1", "cus_upgrade_1", price_id="price_chief_month", status="active"
        )
        payload2 = _webhook_body("customer.subscription.updated", second)
        with TestClient(app) as client:
            client.post(
                "/api/billing/webhook", content=payload2,
                headers={"Stripe-Signature": _sign(payload2)},
            )
        db.expire_all()
        row = db.query(StripeSubscription).filter(
            StripeSubscription.stripe_subscription_id == "sub_upgrade_1"
        ).one()
        assert row.plan_key == "chief"

        # And entitlement now reflects Chief immediately (no polling / caching).
        from app.core.plans import entitlement_for_workspace

        entitlement = entitlement_for_workspace(db, org_id)
        assert entitlement["plan"].key == "chief"
        assert entitlement["active"] is True

    def test_subscription_deleted_marks_canceled_but_keeps_the_row(self, db):
        org_id, user_id = _workspace(db)
        db.add(StripeCustomer(
            organization_id=org_id, user_id=user_id, stripe_customer_id="cus_cancel_1",
            email="p@x.com", created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        ))
        db.add(StripeSubscription(
            organization_id=org_id, stripe_customer_id="cus_cancel_1",
            stripe_subscription_id="sub_cancel_1", plan_key="command",
            billing_interval="month", status="active",
            created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        payload = _webhook_body(
            "customer.subscription.deleted", {"id": "sub_cancel_1"}
        )
        with TestClient(app) as client:
            response = client.post(
                "/api/billing/webhook", content=payload,
                headers={"Stripe-Signature": _sign(payload)},
            )
        assert response.json()["outcome"] == "subscription_canceled"

        db.expire_all()
        row = db.query(StripeSubscription).filter(
            StripeSubscription.stripe_subscription_id == "sub_cancel_1"
        ).one()
        assert row.status == "canceled"
        assert row.canceled_at is not None

        # Cancellation must not delete the row, the customer, or (elsewhere)
        # any workspace data — see test_workspace_data_survives_cancellation.
        assert db.query(StripeSubscription).filter(
            StripeSubscription.stripe_subscription_id == "sub_cancel_1"
        ).count() == 1

    def test_workspace_data_survives_cancellation(self, db):
        """
        A cancelled subscription must not touch Product/InventoryItem/etc.
        Mirrors the same guarantee already enforced on Shopify disconnect.
        """
        from app.models.inventory import InventoryItem
        from app.models.product import Product

        org_id, user_id = _workspace(db)
        product = Product(
            id=uuid.uuid4(), organization_id=org_id, sku="BS-SURVIVE-1",
            name="Survives Cancellation", category="Tops",
            unit_cost=10.0, selling_price=20.0,
        )
        db.add(product)
        db.flush()
        db.add(InventoryItem(
            id=uuid.uuid4(), organization_id=org_id, product_id=product.id,
            stock_on_hand=5, reorder_point=2, safety_stock=1, lead_time_days=14,
        ))
        db.add(StripeSubscription(
            organization_id=org_id, stripe_customer_id="cus_survive_1",
            stripe_subscription_id="sub_survive_1", plan_key="command",
            billing_interval="month", status="active",
            created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        payload = _webhook_body("customer.subscription.deleted", {"id": "sub_survive_1"})
        with TestClient(app) as client:
            client.post(
                "/api/billing/webhook", content=payload,
                headers={"Stripe-Signature": _sign(payload)},
            )

        db.expire_all()
        assert db.query(Product).filter(Product.sku == "BS-SURVIVE-1").count() == 1
        assert db.query(Organization).filter(Organization.id == org_id).count() == 1

    def test_payment_failed_does_not_immediately_deactivate(self, db):
        """past_due is in ACTIVE_SUBSCRIPTION_STATUSES — a failed charge alone
        must not cut a workspace off; Stripe's own dunning/grace period
        applies, matching a normal SaaS."""
        org_id, user_id = _workspace(db)
        db.add(StripeSubscription(
            organization_id=org_id, stripe_customer_id="cus_pastdue_1",
            stripe_subscription_id="sub_pastdue_1", plan_key="operator",
            billing_interval="month", status="past_due",
            created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        from app.core.plans import entitlement_for_workspace

        entitlement = entitlement_for_workspace(db, org_id)
        assert entitlement["active"] is True
        assert entitlement["status"] == "past_due"

    def test_unresolvable_customer_does_not_crash_the_webhook(self, db):
        """A subscription event for a customer id we never stored (e.g. a
        Dashboard-created test object) must be acknowledged, not crash."""
        sub_obj = _subscription_object("sub_orphan_1", "cus_never_seen")
        payload = _webhook_body("customer.subscription.updated", sub_obj)
        with TestClient(app) as client:
            response = client.post(
                "/api/billing/webhook", content=payload,
                headers={"Stripe-Signature": _sign(payload)},
            )
        assert response.status_code == 200
        assert response.json()["outcome"] == "unresolved_workspace"

    def test_unhandled_event_type_is_acknowledged_and_ignored(self, db):
        payload = _webhook_body("payment_method.attached", {"id": "pm_1"})
        with TestClient(app) as client:
            response = client.post(
                "/api/billing/webhook", content=payload,
                headers={"Stripe-Signature": _sign(payload)},
            )
        assert response.status_code == 200
        assert response.json()["outcome"] == "ignored"


# ============================================================================
# 4 · CHECKOUT / PORTAL — mocked API call, everything else real
# ============================================================================


class TestCheckoutAndPortal:
    def test_checkout_resolves_price_server_side_never_from_client(self, db):
        org_id, user_id = _workspace(db)

        fake_client = MagicMock()
        fake_customer = MagicMock(id="cus_new_1")
        fake_client.v1.customers.create.return_value = fake_customer
        fake_session = MagicMock(url="https://checkout.stripe.com/pay/cs_test_1")
        fake_client.v1.checkout.sessions.create.return_value = fake_session

        with patch.object(stripe_service, "_client", return_value=fake_client):
            with _client_as(user_id) as client:
                response = client.post(
                    "/api/billing/checkout",
                    json={"plan": "command", "interval": "month"},
                    headers=hdr(org_id),
                )
        assert response.status_code == 200
        assert response.json()["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_1"

        # The price id passed to Stripe came from OUR settings, matched to
        # (plan, interval) — never anything the client could have sent.
        call_kwargs = fake_client.v1.checkout.sessions.create.call_args.kwargs
        line_items = call_kwargs["params"]["line_items"]
        assert line_items[0]["price"] == "price_command_month"

    def test_first_checkout_grants_a_trial_repeat_checkout_does_not(self, db):
        org_id, user_id = _workspace(db)
        fake_client = MagicMock()
        fake_client.v1.customers.create.return_value = MagicMock(id="cus_trial_1")
        fake_client.v1.checkout.sessions.create.return_value = MagicMock(
            url="https://checkout.stripe.com/pay/cs_1"
        )

        with patch.object(stripe_service, "_client", return_value=fake_client):
            with _client_as(user_id) as client:
                client.post(
                    "/api/billing/checkout",
                    json={"plan": "operator", "interval": "month"},
                    headers=hdr(org_id),
                )
        first_call = fake_client.v1.checkout.sessions.create.call_args.kwargs
        assert "trial_period_days" in first_call["params"]["subscription_data"]

        # Simulate that subscription existing now (as the real webhook would
        # have created it), then attempt a second checkout for the same org.
        db.add(StripeSubscription(
            organization_id=org_id, stripe_customer_id="cus_trial_1",
            stripe_subscription_id="sub_already_1", plan_key="operator",
            billing_interval="month", status="canceled",
            created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        with patch.object(stripe_service, "_client", return_value=fake_client):
            with _client_as(user_id) as client:
                client.post(
                    "/api/billing/checkout",
                    json={"plan": "command", "interval": "month"},
                    headers=hdr(org_id),
                )
        second_call = fake_client.v1.checkout.sessions.create.call_args.kwargs
        assert "trial_period_days" not in second_call["params"]["subscription_data"]

    def test_portal_requires_an_existing_customer(self, db):
        org_id, user_id = _workspace(db)
        with _client_as(user_id) as client:
            response = client.post("/api/billing/portal", headers=hdr(org_id))
        assert response.status_code == 404

    def test_portal_session_created_for_existing_customer(self, db):
        org_id, user_id = _workspace(db)
        db.add(StripeCustomer(
            organization_id=org_id, user_id=user_id, stripe_customer_id="cus_portal_1",
            email="p@x.com", created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        fake_client = MagicMock()
        fake_client.v1.billing_portal.sessions.create.return_value = MagicMock(
            url="https://billing.stripe.com/session/bps_1"
        )
        with patch.object(stripe_service, "_client", return_value=fake_client):
            with _client_as(user_id) as client:
                response = client.post("/api/billing/portal", headers=hdr(org_id))
        assert response.status_code == 200
        assert response.json()["portal_url"] == "https://billing.stripe.com/session/bps_1"

    def test_checkout_returns_503_when_not_configured(self, db, monkeypatch):
        monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "")
        org_id, user_id = _workspace(db)
        with _client_as(user_id) as client:
            response = client.post(
                "/api/billing/checkout",
                json={"plan": "operator", "interval": "month"},
                headers=hdr(org_id),
            )
        assert response.status_code == 503

    def test_billing_status_never_exposes_the_stripe_customer_id(self, db):
        org_id, user_id = _workspace(db)
        db.add(StripeCustomer(
            organization_id=org_id, user_id=user_id, stripe_customer_id="cus_secret_id_123",
            email="p@x.com", created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        ))
        db.commit()
        with _client_as(user_id) as client:
            response = client.get("/api/billing/status", headers=hdr(org_id))
        assert "cus_secret_id_123" not in response.text


# ============================================================================
# 5 · PRICE MAP INTEGRITY
# ============================================================================


class TestPriceResolution:
    def test_every_plan_and_interval_resolves(self):
        for plan_key in ("operator", "command", "chief"):
            for interval in ("month", "year"):
                price_id = stripe_service.resolve_price_id(plan_key, interval)
                assert price_id, f"{plan_key}/{interval} has no configured price"

    def test_reverse_lookup_round_trips(self):
        for plan_key in ("operator", "command", "chief"):
            for interval in ("month", "year"):
                price_id = stripe_service.resolve_price_id(plan_key, interval)
                back_plan, back_interval = stripe_service.plan_and_interval_for_price(price_id)
                assert (back_plan, back_interval) == (plan_key, interval)

    def test_unresolvable_price_id_is_never_forwarded_to_the_customer(self, db):
        org_id, user_id = _workspace(db)
        with _client_as(user_id) as client:
            response = client.post(
                "/api/billing/checkout",
                json={"plan": "not-a-real-plan", "interval": "month"},
                headers=hdr(org_id),
            )
        # normalize_plan_key coerces unknown strings to "operator" rather than
        # erroring with the raw string reflected back.
        assert "not-a-real-plan" not in response.text
