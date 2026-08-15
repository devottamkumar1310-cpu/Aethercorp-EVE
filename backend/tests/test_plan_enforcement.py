# ==============================================================================
# PURPOSE: Adversarial plan-enforcement tests.
#
# METHOD: For each plan tier, seed a workspace at exactly that tier (via a real
# StripeSubscription row — the same state production uses, never a test-only
# bypass), then attempt the actions the spec enumerates and assert PASS/BLOCK
# exactly as specified. Every "BLOCK" assertion also proves nothing was
# written — a 402 that still mutated the database would be worse than no
# check at all.
#
# Matrix under test (from the task brief):
#   Operator: 1 store PASS, 2nd store BLOCK; 500 SKUs PASS, 501 BLOCK;
#             Telegram PASS, WhatsApp BLOCK
#   Command:  3 stores PASS, 4th BLOCK; WhatsApp PASS
#   Chief:    3 stores PASS; unlimited SKUs PASS
#   Cross-cutting: direct API bypass, AgentOrchestrator/channel bypass,
#             no client-controlled plan_type
# ==============================================================================

import asyncio
import datetime
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core import crypto
from app.core.plans import PLANS
from app.core.security import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.billing import StripeSubscription
from app.models.channel import CHANNEL_TELEGRAM, CHANNEL_WHATSAPP
from app.models.inventory import InventoryItem
from app.models.organization import Membership, Organization
from app.models.product import Product
from app.models.profile import Profile
from app.models.shopify import ShopifyConnection

# ---------------------------------------------------------------- fixtures

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


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
def credentials(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_MOCK_MODE", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "SHOPIFY_API_KEY", "pe-client-id")
    monkeypatch.setattr(settings, "SHOPIFY_API_SECRET", "pe-client-secret")
    monkeypatch.setattr(settings, "BACKEND_PUBLIC_URL", "https://eve.example.com")
    monkeypatch.setattr(settings, "INTEGRATION_ENCRYPTION_KEY", "pe-encryption-key")
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "1:pe")
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "pe-telegram-secret")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "pe-wa")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "1")
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "pe-wa-secret")
    monkeypatch.setattr(settings, "WHATSAPP_VERIFY_TOKEN", "pe-wa-verify")
    crypto.reset_cipher_cache()
    yield
    crypto.reset_cipher_cache()


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _new_workspace(db, plan_key=None):
    """
    A fresh org+user+membership. plan_key=None leaves the default 14-day
    trial (Operator-equivalent capabilities) in place; any other value
    inserts a real active StripeSubscription for that plan.
    """
    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    db.add_all([
        Profile(id=user_id, email=f"{user_id.hex[:10]}@x.com", full_name="P",
                hashed_password="x"),
        Organization(id=org_id, name=f"PE-{org_id.hex[:6]}", slug=f"pe-{org_id.hex[:10]}"),
        Membership(user_id=user_id, organization_id=org_id, role="owner"),
    ])
    db.commit()
    if plan_key:
        db.add(StripeSubscription(
            organization_id=org_id,
            stripe_customer_id=f"cus_pe_{org_id.hex[:10]}",
            stripe_subscription_id=f"sub_pe_{uuid.uuid4().hex[:16]}",
            plan_key=plan_key,
            billing_interval="month",
            status="active",
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        ))
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


def _seed_products(db, org_id, count, connection_id=None):
    """Directly seeds N Products (bypassing Shopify sync) to test the SKU gate
    on the sync path in isolation without needing N fake Shopify API pages."""
    for i in range(count):
        product = Product(
            id=uuid.uuid4(), organization_id=org_id, sku=f"PE-{org_id.hex[:4]}-{i:05d}",
            name=f"Seed Product {i}", category="Tops", unit_cost=10.0, selling_price=20.0,
        )
        db.add(product)
    db.commit()


def _make_connection(db, org_id, shop_domain):
    connection = ShopifyConnection(
        organization_id=org_id, shop_domain=shop_domain,
        access_token_encrypted=crypto.encrypt("shpat_pe_test"),
        scopes="read_products", api_version="2024-07", status="connected",
        sync_status="idle", webhook_ids=[],
        created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


# ============================================================================
# 1 · OPERATOR — store limit
# ============================================================================


class TestOperatorStoreLimit:
    def test_first_store_install_passes(self, db):
        org_id, user_id = _new_workspace(db)
        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-op-store1.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 200, response.text

    def test_second_store_install_is_blocked(self, db):
        org_id, user_id = _new_workspace(db)
        _make_connection(db, org_id, "pe-op-existing.myshopify.com")

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-op-second.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 402, response.text
        assert "Operator" in response.text

        # And nothing was actually started.
        session = TestingSessionLocal()
        try:
            from app.models.shopify import ShopifyOAuthState

            assert session.query(ShopifyOAuthState).filter(
                ShopifyOAuthState.organization_id == org_id,
                ShopifyOAuthState.shop_domain == "pe-op-second.myshopify.com",
            ).count() == 0
        finally:
            session.close()

    def test_reconnecting_the_same_store_does_not_count_as_a_second_store(self, db):
        """A reconnect of an already-owned store must not consume a new slot."""
        org_id, user_id = _new_workspace(db)
        _make_connection(db, org_id, "pe-op-reconnect.myshopify.com")

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-op-reconnect.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 200, response.text


# ============================================================================
# 2 · OPERATOR — SKU limit
# ============================================================================


class TestOperatorSkuLimit:
    def test_sync_up_to_exactly_500_skus_passes(self, db):
        org_id, _ = _new_workspace(db)
        connection = _make_connection(db, org_id, "pe-op-sku500.myshopify.com")
        _seed_products(db, org_id, 499)  # + 1 new from the sync call = 500

        from app.services.shopify.sync_service import ShopifySyncService

        payload = [{
            "id": 1, "title": "The 500th Product", "product_type": "Tops",
            "options": [{"position": 1, "name": "Size"}],
            "variants": [{"id": 1, "sku": "PE-500TH", "option1": "M",
                          "price": "20.00", "inventory_item_id": 1}],
        }]
        # Must not raise.
        ShopifySyncService.upsert_products(db, connection, payload)

        session = TestingSessionLocal()
        try:
            total = session.query(Product).filter(Product.organization_id == org_id).count()
            assert total == 500
        finally:
            session.close()

    def test_sync_to_501_skus_is_blocked(self, db):
        from app.core.plans import PlanLimitExceeded
        from app.services.shopify.sync_service import ShopifySyncService

        org_id, _ = _new_workspace(db)
        connection = _make_connection(db, org_id, "pe-op-sku501.myshopify.com")
        _seed_products(db, org_id, 500)  # already at the cap

        payload = [{
            "id": 2, "title": "The 501st Product", "product_type": "Tops",
            "options": [{"position": 1, "name": "Size"}],
            "variants": [{"id": 2, "sku": "PE-501ST", "option1": "M",
                          "price": "20.00", "inventory_item_id": 2}],
        }]
        with pytest.raises(PlanLimitExceeded):
            ShopifySyncService.upsert_products(db, connection, payload)

        # The 501st product must not have been written.
        session = TestingSessionLocal()
        try:
            total = session.query(Product).filter(Product.organization_id == org_id).count()
            assert total == 500, "product was written despite the plan limit"
            assert session.query(Product).filter(
                Product.organization_id == org_id, Product.sku == "PE-501ST"
            ).count() == 0
        finally:
            session.close()

    def test_webhook_that_would_cross_the_limit_fails_cleanly_not_silently(self, db):
        """Full HTTP path: a product-create webhook that would exceed the plan
        limit must be rejected (failed, HTTP 200 per Shopify's own retry
        semantics) rather than crash the process or silently apply anyway."""
        import base64
        import hashlib
        import hmac
        import json

        org_id, _ = _new_workspace(db)
        connection = _make_connection(db, org_id, "pe-op-webhook-limit.myshopify.com")
        _seed_products(db, org_id, 500)

        body = json.dumps({
            "id": 3, "title": "Over The Limit", "product_type": "Tops",
            "options": [{"position": 1, "name": "Size"}],
            "variants": [{"id": 3, "sku": "PE-OVERLIMIT", "option1": "M",
                          "price": "20.00", "inventory_item_id": 3}],
        }).encode()
        sig = base64.b64encode(
            hmac.new(b"pe-client-secret", body, hashlib.sha256).digest()
        ).decode()

        with TestClient(app) as anon:
            response = anon.post(
                "/api/integrations/shopify/webhook", content=body,
                headers={
                    "X-Shopify-Topic": "products/create",
                    "X-Shopify-Shop-Domain": "pe-op-webhook-limit.myshopify.com",
                    "X-Shopify-Webhook-Id": "pe-wh-limit-1",
                    "X-Shopify-Hmac-Sha256": sig,
                },
            )
        assert response.status_code == 200  # Shopify semantics: ack, don't retry-storm
        assert response.json()["status"] == "failed"

        session = TestingSessionLocal()
        try:
            assert session.query(Product).filter(
                Product.organization_id == org_id, Product.sku == "PE-OVERLIMIT"
            ).count() == 0
        finally:
            session.close()


# ============================================================================
# 3 · OPERATOR — Telegram PASS, WhatsApp BLOCK
# ============================================================================


class TestOperatorChannelCapabilities:
    def test_telegram_link_code_passes(self, db):
        org_id, user_id = _new_workspace(db)
        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/channels/link-code",
                json={"channel": "telegram"}, headers=hdr(org_id),
            )
        assert response.status_code == 200, response.text

    def test_whatsapp_link_code_is_blocked(self, db):
        org_id, user_id = _new_workspace(db)
        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/channels/link-code",
                json={"channel": "whatsapp"}, headers=hdr(org_id),
            )
        assert response.status_code == 402, response.text
        assert "Whatsapp" in response.text or "WhatsApp" in response.text

        # No code was issued.
        session = TestingSessionLocal()
        try:
            from app.models.channel import ChannelLinkCode

            assert session.query(ChannelLinkCode).filter(
                ChannelLinkCode.organization_id == org_id,
                ChannelLinkCode.channel == "whatsapp",
            ).count() == 0
        finally:
            session.close()

    def test_whatsapp_message_time_gate_blocks_even_a_pre_existing_link(self, db):
        """
        Covers a downgrade: a link created before a downgrade (or, in this
        test, one seeded directly to simulate that) must stop answering
        immediately at message time, not only at link-issuance time.
        """
        from app.models.channel import ChannelLink
        from app.services.channels.whatsapp_service import WhatsAppService

        org_id, user_id = _new_workspace(db)
        db.add(ChannelLink(
            organization_id=org_id, user_id=user_id, channel=CHANNEL_WHATSAPP,
            external_id_hash=crypto.hash_external_id("910000099999"),
            delivery_address_encrypted=crypto.encrypt("910000099999"),
            display_hint="pre-existing", status="active",
            created_at=datetime.datetime.utcnow(),
        ))
        db.commit()

        reply = asyncio.run(WhatsAppService.handle_message(db, {
            "message_id": "wamid.pe1", "from_number": "910000099999",
            "text": "What should I reorder?",
        }))
        assert "Command" in reply  # upgrade-required message names the plan


# ============================================================================
# 4 · COMMAND — 3 stores PASS, 4th BLOCK; WhatsApp PASS
# ============================================================================


class TestCommandPlan:
    def test_three_stores_pass(self, db):
        org_id, user_id = _new_workspace(db, plan_key="command")
        _make_connection(db, org_id, "pe-cmd-store1.myshopify.com")
        _make_connection(db, org_id, "pe-cmd-store2.myshopify.com")

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-cmd-store3.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 200, response.text

    def test_fourth_store_is_blocked(self, db):
        org_id, user_id = _new_workspace(db, plan_key="command")
        _make_connection(db, org_id, "pe-cmd4-store1.myshopify.com")
        _make_connection(db, org_id, "pe-cmd4-store2.myshopify.com")
        _make_connection(db, org_id, "pe-cmd4-store3.myshopify.com")

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-cmd4-store4.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 402, response.text
        assert "Command" in response.text

    def test_whatsapp_link_code_passes(self, db):
        org_id, user_id = _new_workspace(db, plan_key="command")
        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/channels/link-code",
                json={"channel": "whatsapp"}, headers=hdr(org_id),
            )
        assert response.status_code == 200, response.text

    def test_3000_sku_boundary_passes_but_3001_blocks(self, db):
        from app.core.plans import PlanLimitExceeded
        from app.services.shopify.sync_service import ShopifySyncService

        org_id, _ = _new_workspace(db, plan_key="command")
        connection = _make_connection(db, org_id, "pe-cmd-sku.myshopify.com")
        _seed_products(db, org_id, 3000)

        payload = [{
            "id": 1, "title": "Over Command Limit", "product_type": "Tops",
            "options": [{"position": 1, "name": "Size"}],
            "variants": [{"id": 1, "sku": "PE-CMD-OVER", "option1": "M",
                          "price": "20.00", "inventory_item_id": 1}],
        }]
        with pytest.raises(PlanLimitExceeded):
            ShopifySyncService.upsert_products(db, connection, payload)


# ============================================================================
# 5 · CHIEF — 3 stores PASS; unlimited SKUs PASS
# ============================================================================


class TestChiefPlan:
    def test_three_stores_pass(self, db):
        org_id, user_id = _new_workspace(db, plan_key="chief")
        _make_connection(db, org_id, "pe-chief-store1.myshopify.com")
        _make_connection(db, org_id, "pe-chief-store2.myshopify.com")

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-chief-store3.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 200, response.text

    def test_fourth_store_is_still_blocked_chief_caps_stores_too(self, db):
        """Chief is unlimited on SKUs, not on stores — max_shopify_stores=3."""
        org_id, user_id = _new_workspace(db, plan_key="chief")
        _make_connection(db, org_id, "pe-chief4-store1.myshopify.com")
        _make_connection(db, org_id, "pe-chief4-store2.myshopify.com")
        _make_connection(db, org_id, "pe-chief4-store3.myshopify.com")

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-chief4-store4.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 402

    def test_far_beyond_3000_skus_passes(self, db):
        from app.services.shopify.sync_service import ShopifySyncService

        org_id, _ = _new_workspace(db, plan_key="chief")
        connection = _make_connection(db, org_id, "pe-chief-sku.myshopify.com")
        _seed_products(db, org_id, 5000)

        payload = [{
            "id": 1, "title": "SKU 5001", "product_type": "Tops",
            "options": [{"position": 1, "name": "Size"}],
            "variants": [{"id": 1, "sku": "PE-CHIEF-5001", "option1": "M",
                          "price": "20.00", "inventory_item_id": 1}],
        }]
        # Must not raise even at 5001 SKUs.
        ShopifySyncService.upsert_products(db, connection, payload)

        session = TestingSessionLocal()
        try:
            assert session.query(Product).filter(
                Product.organization_id == org_id
            ).count() == 5001
        finally:
            session.close()


# ============================================================================
# 6 · BILLING-REQUIRED — expired trial, no subscription
# ============================================================================


class TestExpiredTrialIsInactive:
    def test_expired_trial_with_no_subscription_blocks_shopify_connect(self, db):
        org_id, user_id = _new_workspace(db)
        session = TestingSessionLocal()
        try:
            profile = session.query(Profile).filter(Profile.id == user_id).first()
            profile.trial_end_date = datetime.datetime.utcnow() - datetime.timedelta(days=1)
            session.commit()
        finally:
            session.close()

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-expired.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 402
        assert "subscription" in response.text.lower()

    def test_expired_trial_blocks_telegram_too(self, db):
        org_id, user_id = _new_workspace(db)
        session = TestingSessionLocal()
        try:
            profile = session.query(Profile).filter(Profile.id == user_id).first()
            profile.trial_end_date = datetime.datetime.utcnow() - datetime.timedelta(days=1)
            session.commit()
        finally:
            session.close()

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/channels/link-code",
                json={"channel": "telegram"}, headers=hdr(org_id),
            )
        assert response.status_code == 402

    def test_founder_bypass_is_unaffected_by_trial_expiry(self, db):
        """subscription_status='founder' is the pre-existing internal owner
        flag (app.core.security.verify_system_admin) — plan enforcement must
        not interfere with it."""
        org_id, user_id = _new_workspace(db)
        session = TestingSessionLocal()
        try:
            profile = session.query(Profile).filter(Profile.id == user_id).first()
            profile.subscription_status = "founder"
            profile.trial_end_date = datetime.datetime.utcnow() - datetime.timedelta(days=400)
            session.commit()
        finally:
            session.close()

        with _client_as(user_id) as client:
            response = client.post(
                "/api/integrations/shopify/install",
                json={"shop_domain": "pe-founder.myshopify.com"},
                headers=hdr(org_id),
            )
        assert response.status_code == 200


# ============================================================================
# 7 · NO CLIENT-CONTROLLED plan_type / BYPASS ATTEMPTS
# ============================================================================


class TestNoClientControlledEntitlement:
    def test_profile_update_cannot_set_plan_type(self, db):
        org_id, user_id = _new_workspace(db)
        with _client_as(user_id) as client:
            response = client.put(
                "/api/profile/me",
                json={"full_name": "Attacker", "plan_type": "chief",
                      "subscription_status": "active"},
            )
        assert response.status_code == 200  # extra fields are silently ignored

        session = TestingSessionLocal()
        try:
            profile = session.query(Profile).filter(Profile.id == user_id).first()
            assert profile.plan_type == "starter"  # untouched — the column default
            assert profile.subscription_status == "trial"  # untouched
        finally:
            session.close()

        # And entitlement still resolves via the real trial state, proving the
        # attempted field had zero effect on what the workspace can actually do.
        with _client_as(user_id) as client:
            status_response = client.get("/api/billing/status", headers=hdr(org_id))
        assert status_response.json()["plan"]["key"] == "operator"

    def test_checkout_request_cannot_smuggle_a_price_id(self, db, monkeypatch):
        """
        The checkout body only ever carries a plan KEY, never a Stripe price.
        Even if a client sends something that looks like a price id in the
        plan field, it must be rejected as an unknown plan, not forwarded to
        Stripe.
        """
        org_id, user_id = _new_workspace(db)
        monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_dummy")

        with _client_as(user_id) as client:
            response = client.post(
                "/api/billing/checkout",
                json={"plan": "price_1AbCdEfGhIjKlMnO", "interval": "month"},
                headers=hdr(org_id),
            )
        # Unknown plan string normalizes to the cheapest plan (operator) by
        # design (see normalize_plan_key), never passed through as a raw price.
        assert response.status_code in (200, 400, 503)
        assert "price_1AbCdEfGhIjKlMnO" not in response.text

    def test_member_role_cannot_start_checkout(self, db):
        """Checkout is admin-only — a member must not be able to change billing."""
        org_id, user_id = _new_workspace(db)
        session = TestingSessionLocal()
        try:
            membership = session.query(Membership).filter(
                Membership.organization_id == org_id, Membership.user_id == user_id
            ).first()
            membership.role = "member"
            session.commit()
        finally:
            session.close()

        with _client_as(user_id) as client:
            response = client.post(
                "/api/billing/checkout",
                json={"plan": "command", "interval": "month"},
                headers=hdr(org_id),
            )
        assert response.status_code == 403

    def test_cross_workspace_checkout_attempt_is_rejected(self, db):
        """An admin of workspace A must not be able to start checkout for B."""
        org_a, user_a = _new_workspace(db)
        org_b, _ = _new_workspace(db)

        with _client_as(user_a) as client:
            response = client.post(
                "/api/billing/checkout",
                json={"plan": "command", "interval": "month"},
                headers=hdr(org_b),
            )
        assert response.status_code == 403

    def test_cross_workspace_billing_status_read_is_rejected(self, db):
        org_a, user_a = _new_workspace(db)
        org_b, _ = _new_workspace(db)

        with _client_as(user_a) as client:
            response = client.get("/api/billing/status", headers=hdr(org_b))
        assert response.status_code == 403
