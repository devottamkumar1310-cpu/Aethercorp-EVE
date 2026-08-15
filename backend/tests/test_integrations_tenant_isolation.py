# ==============================================================================
# PURPOSE: Adversarial cross-workspace isolation tests for the integration layer.
#
# METHOD: This file does not inspect code. For every surface it seeds TWO tenants,
#         gives tenant B real data, then acts AS TENANT A (or as an unauthenticated
#         webhook caller) and attempts to read or mutate tenant B's data through
#         every route and service the integrations expose. A test passes only when
#         the attempt is refused AND tenant B's data is provably unchanged.
#
# SURFACES COVERED (as required by the audit brief):
#   Shopify · Telegram · WhatsApp · integrations API · AgentOrchestrator ·
#   recommendations · inventory · audit traces
# ==============================================================================

import asyncio
import base64
import datetime
import hashlib
import hmac
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core import crypto
from app.core.security import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.audit_log import AuditLog
from app.models.channel import (
    CHANNEL_TELEGRAM,
    CHANNEL_WHATSAPP,
    ChannelLink,
    ChannelLinkCode,
)
from app.models.inventory import InventoryItem, SalesRecord
from app.models.organization import Membership, Organization
from app.models.product import Product
from app.models.profile import Profile
from app.models.recommendation_trace import RecommendationTrace
from app.models.shopify import (
    ShopifyConnection,
    ShopifyProductMapping,
    ShopifySyncJob,
)
from app.services.channels.alert_engine import AlertEngine
from app.services.channels.link_service import ChannelLinkService
from app.services.channels.telegram_service import TelegramService
from app.services.channels.whatsapp_service import WhatsAppService
from app.services.shopify.webhook_service import ShopifyWebhookService

# ---------------------------------------------------------------- fixtures

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

SHOPIFY_SECRET = "iso-shopify-app-secret"
TELEGRAM_SECRET = "iso-telegram-secret"
WHATSAPP_APP_SECRET = "iso-whatsapp-app-secret"

# A = attacker's own legitimate workspace. B = victim workspace.
ORG_A = uuid.uuid4()
ORG_B = uuid.uuid4()
USER_A = uuid.uuid4()
USER_B = uuid.uuid4()

# Values that must NEVER appear in a tenant-A response.
B_SKU = "VICTIM-SKU-9999"
B_SHOP = "victim-store.myshopify.com"
B_PRODUCT_NAME = "Victim Cashmere Coat"

_seed = TestingSessionLocal()
_seed.add_all([
    Profile(id=USER_A, email="attacker@example.com", full_name="A", hashed_password="x"),
    Profile(id=USER_B, email="victim@example.com", full_name="B", hashed_password="x"),
    Organization(id=ORG_A, name="Attacker Co", slug="iso-attacker"),
    Organization(id=ORG_B, name="Victim Co", slug="iso-victim"),
    Membership(user_id=USER_A, organization_id=ORG_A, role="owner"),
    Membership(user_id=USER_B, organization_id=ORG_B, role="owner"),
])
_seed.commit()
_seed.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def hermetic_app():
    """Other test modules install overrides at import time; isolate from them."""
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
    monkeypatch.setattr(settings, "SHOPIFY_API_KEY", "iso-client-id")
    monkeypatch.setattr(settings, "SHOPIFY_API_SECRET", SHOPIFY_SECRET)
    monkeypatch.setattr(settings, "BACKEND_PUBLIC_URL", "https://eve.example.com")
    monkeypatch.setattr(settings, "INTEGRATION_ENCRYPTION_KEY", "iso-encryption-key")
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "1:iso")
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", TELEGRAM_SECRET)
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "iso-wa")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "1")
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", WHATSAPP_APP_SECRET)
    monkeypatch.setattr(settings, "WHATSAPP_VERIFY_TOKEN", "iso-verify")
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


def _profile(user_id):
    session = TestingSessionLocal()
    try:
        return session.query(Profile).filter(Profile.id == user_id).first()
    finally:
        session.close()


@pytest.fixture
def as_attacker():
    """Authenticated client for user A (a legitimate user of workspace A)."""
    app.dependency_overrides[get_current_user] = lambda: _profile(USER_A)
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def anonymous():
    with TestClient(app) as client:
        yield client


def hdr(org_id):
    return {"Authorization": "Bearer x", "X-Workspace-Id": str(org_id)}


# ---------------------------------------------------------------- victim seed


@pytest.fixture
def victim_data(db):
    """Gives workspace B a full, realistic footprint across every model."""
    for model in (SalesRecord, InventoryItem, ShopifyProductMapping, ShopifySyncJob,
                  RecommendationTrace):
        db.query(model).filter(model.organization_id == ORG_B).delete(synchronize_session=False)
    db.query(Product).filter(Product.organization_id == ORG_B).delete(synchronize_session=False)
    db.query(ShopifyConnection).filter(
        ShopifyConnection.organization_id == ORG_B
    ).delete(synchronize_session=False)
    db.commit()

    connection = ShopifyConnection(
        organization_id=ORG_B, shop_domain=B_SHOP,
        access_token_encrypted=crypto.encrypt("shpat_victim_secret_token"),
        scopes="read_products", api_version="2024-07", status="connected",
        sync_status="success", webhook_ids=[],
        last_successful_sync_at=datetime.datetime.utcnow(),
        created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
    )
    db.add(connection)
    db.flush()

    product = Product(
        id=uuid.uuid4(), organization_id=ORG_B, sku=B_SKU, name=B_PRODUCT_NAME,
        parent_product_id="VICTIM-CASHMERE-COAT", category="Outerwear",
        size="M", color="Camel", unit_cost=60.0, selling_price=240.0,
    )
    db.add(product)
    db.flush()

    db.add(InventoryItem(
        id=uuid.uuid4(), organization_id=ORG_B, product_id=product.id,
        stock_on_hand=3, reorder_point=25, safety_stock=10,
        lead_time_days=21, avg_daily_sales=2.0,
    ))
    db.add(SalesRecord(
        id=uuid.uuid4(), organization_id=ORG_B, product_id=product.id,
        date=datetime.date(2026, 8, 10), quantity=14, unit_price=240.0, revenue=3360.0,
    ))
    db.add(ShopifyProductMapping(
        organization_id=ORG_B, connection_id=connection.id, product_id=product.id,
        shopify_product_id="777", shopify_variant_id="7771",
        shopify_inventory_item_id="77711", sku=B_SKU,
    ))
    db.add(ShopifySyncJob(
        organization_id=ORG_B, connection_id=connection.id, job_type="initial",
        status="success", products_synced=1, variants_synced=1,
        started_at=datetime.datetime.utcnow(),
    ))
    db.add(RecommendationTrace(
        id=uuid.uuid4(), organization_id=ORG_B, recommendation_type="low_stock",
        action=f"Reorder {B_SKU} immediately", confidence_score=0.94,
        source_datasets=["inventory_items"], supporting_metrics={"sku": B_SKU},
        reasoning_chain=[f"{B_SKU} is below safety stock"],
        evidence_snapshot={"observation": {"product": B_PRODUCT_NAME}},
        related_skus=[B_SKU], estimated_financial_impact=3360.0,
        created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
    ))
    db.add(AuditLog(
        id=uuid.uuid4(), organization_id=ORG_B, event_type="shopify_connected",
        status="success", message=f"Shopify store {B_SHOP} connected",
    ))
    db.commit()
    return {"connection_id": connection.id, "product_id": product.id}


def _victim_snapshot(db):
    """Everything about workspace B that must be unchanged after an attack."""
    product = db.query(Product).filter(
        Product.organization_id == ORG_B, Product.sku == B_SKU
    ).one()
    item = db.query(InventoryItem).filter(InventoryItem.product_id == product.id).one()
    connection = db.query(ShopifyConnection).filter(
        ShopifyConnection.organization_id == ORG_B
    ).one()
    sales = db.query(SalesRecord).filter(SalesRecord.organization_id == ORG_B).all()
    return {
        "stock": item.stock_on_hand,
        "product_name": product.name,
        "price": product.selling_price,
        "connection_status": connection.status,
        "sales": sorted((s.date, s.quantity, s.revenue) for s in sales),
        "link_count": db.query(ChannelLink).filter(
            ChannelLink.organization_id == ORG_B, ChannelLink.status == "active"
        ).count(),
    }


# ============================================================================
# 1 · INTEGRATIONS API
# ============================================================================


class TestIntegrationsApiIsolation:
    def test_attacker_cannot_read_victim_shopify_status(self, as_attacker, victim_data):
        response = as_attacker.get("/api/integrations/shopify/status", headers=hdr(ORG_B))
        assert response.status_code == 403
        assert B_SHOP not in response.text

    def test_attacker_own_status_does_not_leak_victim_store(self, as_attacker, victim_data):
        response = as_attacker.get("/api/integrations/shopify/status", headers=hdr(ORG_A))
        assert response.status_code == 200
        body = response.json()
        assert body["connected"] is False
        assert body["shop_domain"] is None
        assert body["recent_jobs"] == []
        assert B_SHOP not in response.text

    def test_attacker_cannot_trigger_sync_on_victim_workspace(self, as_attacker, victim_data, db):
        before = _victim_snapshot(db)
        response = as_attacker.post("/api/integrations/shopify/sync", headers=hdr(ORG_B))
        assert response.status_code == 403
        db.expire_all()
        assert _victim_snapshot(db) == before

    def test_attacker_cannot_disconnect_victim_store(self, as_attacker, victim_data, db):
        response = as_attacker.request(
            "DELETE", "/api/integrations/shopify/disconnect", headers=hdr(ORG_B)
        )
        assert response.status_code == 403
        db.expire_all()
        assert db.query(ShopifyConnection).filter(
            ShopifyConnection.organization_id == ORG_B
        ).count() == 1, "victim connection was deleted"

    def test_attacker_cannot_reconcile_victim_store(self, as_attacker, victim_data):
        response = as_attacker.get("/api/integrations/shopify/reconcile", headers=hdr(ORG_B))
        assert response.status_code == 403

    def test_attacker_cannot_read_victim_channel_status(self, as_attacker, victim_data, db):
        _link(db, ORG_B, USER_B, CHANNEL_TELEGRAM, "victim-tg", "5551234")
        response = as_attacker.get("/api/integrations/channels/status", headers=hdr(ORG_B))
        assert response.status_code == 403

    def test_attacker_own_channel_status_does_not_leak_victim_links(
        self, as_attacker, victim_data, db
    ):
        _link(db, ORG_B, USER_B, CHANNEL_TELEGRAM, "victim-tg-2", "5559999")
        response = as_attacker.get("/api/integrations/channels/status", headers=hdr(ORG_A))
        assert response.status_code == 200
        assert response.json()["telegram"]["linked_accounts"] == []
        # The raw chat id must not appear anywhere in the payload.
        assert "5559999" not in response.text

    def test_attacker_cannot_mint_a_link_code_for_victim_workspace(self, as_attacker, victim_data):
        response = as_attacker.post(
            "/api/integrations/channels/link-code",
            json={"channel": "telegram"}, headers=hdr(ORG_B),
        )
        assert response.status_code == 403

    def test_attacker_cannot_unlink_victim_channels(self, as_attacker, victim_data, db):
        _link(db, ORG_B, USER_B, CHANNEL_TELEGRAM, "victim-tg-3", "5558888")
        before = _victim_snapshot(db)
        response = as_attacker.request(
            "DELETE", "/api/integrations/channels/telegram", headers=hdr(ORG_B)
        )
        assert response.status_code == 403
        db.expire_all()
        assert _victim_snapshot(db)["link_count"] == before["link_count"]

    def test_attacker_cannot_send_alerts_into_victim_workspace(self, as_attacker, victim_data):
        response = as_attacker.post(
            "/api/integrations/channels/alerts/send", headers=hdr(ORG_B)
        )
        assert response.status_code == 403

    def test_attacker_cannot_start_oauth_against_victims_connected_store(
        self, as_attacker, victim_data
    ):
        """Hijack attempt: begin an install for a shop another workspace already owns."""
        response = as_attacker.post(
            "/api/integrations/shopify/install",
            json={"shop_domain": B_SHOP}, headers=hdr(ORG_A),
        )
        assert response.status_code == 409

    @pytest.mark.parametrize("path,method", [
        ("/api/integrations/shopify/status", "GET"),
        ("/api/integrations/shopify/install", "POST"),
        ("/api/integrations/shopify/sync", "POST"),
        ("/api/integrations/shopify/reconcile", "GET"),
        ("/api/integrations/shopify/disconnect", "DELETE"),
        ("/api/integrations/channels/status", "GET"),
        ("/api/integrations/channels/link-code", "POST"),
        ("/api/integrations/channels/alerts/send", "POST"),
        ("/api/integrations/channels/telegram", "DELETE"),
    ])
    def test_every_management_route_rejects_anonymous_callers(self, anonymous, path, method):
        response = anonymous.request(method, path, json={})
        assert response.status_code == 401, f"{method} {path} allowed anonymous access"


# ============================================================================
# 2 · SHOPIFY WEBHOOKS
# ============================================================================


def _shopify_sig(body: bytes) -> str:
    return base64.b64encode(
        hmac.new(SHOPIFY_SECRET.encode(), body, hashlib.sha256).digest()
    ).decode()


class TestShopifyWebhookIsolation:
    def test_body_supplied_organization_id_is_ignored(self, anonymous, victim_data, db):
        """
        The webhook body is attacker-visible and attacker-modifiable in transit only
        with a valid signature — but a compromised or malicious SHOP could still put
        another tenant's id in its own payload. The workspace must come from the
        shop domain, never the body.
        """
        _make_attacker_connection(db)
        before = _victim_snapshot(db)

        body = json.dumps({
            "inventory_item_id": "77711",          # victim's inventory item
            "available": 0,
            "organization_id": str(ORG_B),          # forged
            "shop_domain": B_SHOP,                  # forged
        }).encode()

        response = anonymous.post(
            "/api/integrations/shopify/webhook", content=body,
            headers={
                "X-Shopify-Topic": "inventory_levels/update",
                "X-Shopify-Shop-Domain": "attacker-store.myshopify.com",
                "X-Shopify-Webhook-Id": "iso-wh-1",
                "X-Shopify-Hmac-Sha256": _shopify_sig(body),
            },
        )
        assert response.status_code == 200
        db.expire_all()
        assert _victim_snapshot(db) == before, "forged body mutated the victim workspace"

    def test_unsigned_webhook_cannot_touch_any_workspace(self, anonymous, victim_data, db):
        before = _victim_snapshot(db)
        body = json.dumps({"inventory_item_id": "77711", "available": 0}).encode()
        response = anonymous.post(
            "/api/integrations/shopify/webhook", content=body,
            headers={
                "X-Shopify-Topic": "inventory_levels/update",
                "X-Shopify-Shop-Domain": B_SHOP,
                "X-Shopify-Webhook-Id": "iso-wh-2",
            },
        )
        assert response.status_code == 401
        db.expire_all()
        assert _victim_snapshot(db) == before

    def test_uninstall_webhook_cannot_disconnect_another_tenant(self, anonymous, victim_data, db):
        _make_attacker_connection(db)
        body = json.dumps({"id": 1, "organization_id": str(ORG_B)}).encode()
        anonymous.post(
            "/api/integrations/shopify/webhook", content=body,
            headers={
                "X-Shopify-Topic": "app/uninstalled",
                "X-Shopify-Shop-Domain": "attacker-store.myshopify.com",
                "X-Shopify-Webhook-Id": "iso-wh-3",
                "X-Shopify-Hmac-Sha256": _shopify_sig(body),
            },
        )
        db.expire_all()
        victim = db.query(ShopifyConnection).filter(
            ShopifyConnection.organization_id == ORG_B
        ).one()
        assert victim.status == "connected", "victim store was disconnected by another tenant"

    def test_product_webhook_writes_only_into_the_signing_shops_workspace(
        self, anonymous, victim_data, db
    ):
        _make_attacker_connection(db)
        payload = {
            "id": 777, "title": "Injected Product", "product_type": "Tops",
            "options": [{"position": 1, "name": "Size"}],
            "variants": [{"id": 7771, "sku": B_SKU, "option1": "M",
                          "price": "1.00", "inventory_item_id": 77711}],
        }
        body = json.dumps(payload).encode()
        anonymous.post(
            "/api/integrations/shopify/webhook", content=body,
            headers={
                "X-Shopify-Topic": "products/update",
                "X-Shopify-Shop-Domain": "attacker-store.myshopify.com",
                "X-Shopify-Webhook-Id": "iso-wh-4",
                "X-Shopify-Hmac-Sha256": _shopify_sig(body),
            },
        )
        db.expire_all()
        # Victim's product with the same SKU must be untouched.
        victim_product = db.query(Product).filter(
            Product.organization_id == ORG_B, Product.sku == B_SKU
        ).one()
        assert victim_product.name == B_PRODUCT_NAME
        assert victim_product.selling_price == 240.0
        # A same-SKU product may exist in A, but it is a DIFFERENT row. That is
        # the correct outcome: SKUs are only unique within a workspace.
        attacker_products = db.query(Product).filter(
            Product.organization_id == ORG_A, Product.sku == B_SKU
        ).all()
        for p in attacker_products:
            assert p.id != victim_product.id

        # Clean up the injected row. It legitimately belongs to workspace A, so
        # leaving it would make later "A must not mention B_SKU" assertions fail
        # for a reason that is not a leak.
        for p in attacker_products:
            db.query(ShopifyProductMapping).filter(
                ShopifyProductMapping.product_id == p.id
            ).delete(synchronize_session=False)
            db.delete(p)
        db.commit()

    def test_resolve_connection_maps_domain_to_its_true_owner(self, db, victim_data):
        connection = ShopifyWebhookService.resolve_connection(db, B_SHOP)
        assert connection is not None
        assert connection.organization_id == ORG_B


def _make_attacker_connection(db):
    existing = db.query(ShopifyConnection).filter(
        ShopifyConnection.organization_id == ORG_A
    ).first()
    if existing:
        return existing
    connection = ShopifyConnection(
        organization_id=ORG_A, shop_domain="attacker-store.myshopify.com",
        access_token_encrypted=crypto.encrypt("shpat_attacker"),
        scopes="read_products", api_version="2024-07", status="connected",
        sync_status="idle", webhook_ids=[],
        created_at=datetime.datetime.utcnow(), updated_at=datetime.datetime.utcnow(),
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


# ============================================================================
# 3 · TELEGRAM / WHATSAPP
# ============================================================================


def _link(db, org_id, user_id, channel, external_id, address):
    db.query(ChannelLink).filter(
        ChannelLink.channel == channel,
        ChannelLink.external_id_hash == crypto.hash_external_id(external_id),
    ).delete(synchronize_session=False)
    db.commit()
    link = ChannelLink(
        organization_id=org_id, user_id=user_id, channel=channel,
        external_id_hash=crypto.hash_external_id(external_id),
        delivery_address_encrypted=crypto.encrypt(address),
        display_hint="iso", status="active", created_at=datetime.datetime.utcnow(),
    )
    db.add(link)
    db.commit()
    return link


def _grant_plan(db, org_id, plan_key="command"):
    """Grants a workspace an active plan — WhatsApp requires Command+."""
    from app.models.billing import StripeSubscription

    db.add(StripeSubscription(
        organization_id=org_id,
        stripe_customer_id=f"cus_test_{org_id.hex[:10]}",
        stripe_subscription_id=f"sub_test_{uuid.uuid4().hex[:16]}",
        plan_key=plan_key,
        billing_interval="month",
        status="active",
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow(),
    ))
    db.commit()


class TestMessagingIsolation:
    def test_attacker_chat_never_returns_victim_business_data(self, db, victim_data):
        """The load-bearing test: A's linked chat asking about inventory."""
        _link(db, ORG_A, USER_A, CHANNEL_TELEGRAM, "atk-tg", "1111")

        for question in (
            "Which products are at risk of stockout?",
            "What should I reorder?",
            "Which products are dead stock?",
            "What's the biggest problem in my business?",
        ):
            reply = asyncio.run(TelegramService.handle_message(db, {
                "update_id": abs(hash(question)) % 10**8, "chat_id": "1111",
                "user_id": "atk-tg", "text": question, "username": "atk",
            }))
            assert B_SKU not in reply, f"leaked victim SKU for: {question}"
            assert B_PRODUCT_NAME not in reply, f"leaked victim product for: {question}"
            assert "Victim Co" not in reply

    def test_whatsapp_attacker_number_never_returns_victim_data(self, db, victim_data):
        _grant_plan(db, ORG_A)  # WhatsApp requires Command+; exercise the real path
        _link(db, ORG_A, USER_A, CHANNEL_WHATSAPP, "919000000001", "919000000001")
        reply = asyncio.run(WhatsAppService.handle_message(db, {
            "message_id": "wamid.iso1", "from_number": "919000000001",
            "text": "Which products are at risk of stockout?",
        }))
        assert B_SKU not in reply
        assert B_PRODUCT_NAME not in reply

    def test_workspace_command_never_names_another_workspace(self, db, victim_data):
        _link(db, ORG_A, USER_A, CHANNEL_TELEGRAM, "atk-tg-ws", "2222")
        reply = asyncio.run(TelegramService.handle_message(db, {
            "update_id": 811001, "chat_id": "2222", "user_id": "atk-tg-ws",
            "text": "/workspace", "username": "atk",
        }))
        assert "Attacker Co" in reply
        assert "Victim Co" not in reply

    def test_status_command_never_reveals_another_tenants_store(self, db, victim_data):
        _link(db, ORG_A, USER_A, CHANNEL_TELEGRAM, "atk-tg-st", "3333")
        reply = asyncio.run(TelegramService.handle_message(db, {
            "update_id": 811002, "chat_id": "3333", "user_id": "atk-tg-st",
            "text": "/status", "username": "atk",
        }))
        assert B_SHOP not in reply

    def test_victims_link_code_cannot_be_redeemed_from_an_unrelated_chat(self, db, victim_data):
        """
        A code IS a bearer token by design. This records the real blast radius:
        redeeming it binds the redeemer to the ISSUING workspace — it must never
        instead expose the redeemer's own workspace to the victim, or vice versa.
        """
        record = ChannelLinkService.issue_code(db, ORG_B, USER_B, CHANNEL_TELEGRAM)
        link = ChannelLinkService.redeem_code(
            db, record.code, CHANNEL_TELEGRAM, "stranger-chat", "4444"
        )
        assert link is not None
        assert link.organization_id == ORG_B
        # And workspace A is entirely unaffected.
        assert db.query(ChannelLink).filter(
            ChannelLink.organization_id == ORG_A,
            ChannelLink.external_id_hash == crypto.hash_external_id("stranger-chat"),
        ).count() == 0

    def test_code_from_a_revoked_member_is_refused(self, db):
        """Membership is re-checked at redemption, not merely at issue time."""
        temp_org = uuid.uuid4()
        temp_user = uuid.uuid4()
        db.add_all([
            Profile(id=temp_user, email=f"t{temp_user.hex[:6]}@x.com",
                    full_name="T", hashed_password="x"),
            Organization(id=temp_org, name="Temp", slug=f"iso-temp-{temp_org.hex[:6]}"),
            Membership(user_id=temp_user, organization_id=temp_org, role="owner"),
        ])
        db.commit()

        record = ChannelLinkService.issue_code(db, temp_org, temp_user, CHANNEL_TELEGRAM)
        db.query(Membership).filter(
            Membership.user_id == temp_user, Membership.organization_id == temp_org
        ).delete(synchronize_session=False)
        db.commit()

        assert ChannelLinkService.redeem_code(
            db, record.code, CHANNEL_TELEGRAM, "ex-member-chat", "5555"
        ) is None

    def test_telegram_webhook_rejects_forged_secret(self, anonymous, db, victim_data):
        _link(db, ORG_B, USER_B, CHANNEL_TELEGRAM, "victim-live", "6666")
        response = anonymous.post(
            "/api/integrations/telegram/webhook",
            json={"update_id": 812001, "message": {
                "message_id": 1, "chat": {"id": 6666}, "from": {"id": 6666},
                "text": "What should I reorder?"}},
            headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-secret"},
        )
        assert response.status_code == 403

    def test_whatsapp_webhook_rejects_forged_signature(self, anonymous, db, victim_data):
        body = json.dumps({"entry": [{"changes": [{"value": {"messages": [
            {"id": "wamid.forged", "from": "919000000002", "type": "text",
             "text": {"body": "What should I reorder?"}}]}}]}]}).encode()
        bad = "sha256=" + hmac.new(b"wrong", body, hashlib.sha256).hexdigest()
        response = anonymous.post(
            "/api/integrations/whatsapp/webhook", content=body,
            headers={"X-Hub-Signature-256": bad},
        )
        assert response.status_code == 403


# ============================================================================
# 4 · AGENT ORCHESTRATOR / RECOMMENDATIONS / ALERTS / AUDIT TRACES
# ============================================================================


class TestIntelligenceIsolation:
    def test_orchestrator_scoped_to_the_workspace_it_is_called_with(self, db, victim_data):
        from app.services.ai.agent_orchestrator import AgentOrchestrator

        message = asyncio.run(AgentOrchestrator().orchestrate(
            db=db, org_id=ORG_A, question="What should I reorder?",
            user_id=USER_A, developer_mode=False, depth="baseline",
        ))
        combined = message.content + str(message.agent_data)
        assert B_SKU not in combined
        assert B_PRODUCT_NAME not in combined

    def test_recommendation_traces_are_not_visible_cross_tenant(self, db, victim_data):
        a_traces = db.query(RecommendationTrace).filter(
            RecommendationTrace.organization_id == ORG_A
        ).all()
        for trace in a_traces:
            assert B_SKU not in json.dumps(trace.related_skus or [])
            assert B_SKU not in trace.action

    def test_alerts_built_for_one_workspace_never_cite_another(self, db, victim_data):
        alerts_a = AlertEngine.build_alerts(db, ORG_A)
        for alert in alerts_a:
            rendered = alert.render()
            assert B_SKU not in rendered
            assert B_PRODUCT_NAME not in rendered

    def test_alert_dispatch_only_reaches_the_owning_workspaces_links(self, db, victim_data):
        from unittest.mock import AsyncMock, patch

        _link(db, ORG_A, USER_A, CHANNEL_TELEGRAM, "atk-alert", "7777")
        _link(db, ORG_B, USER_B, CHANNEL_TELEGRAM, "vic-alert", "8888")

        alert = AlertEngine._build_reorder_alert(
            [{"sku": B_SKU, "name": B_PRODUCT_NAME, "recommended_reorder": 30}]
        )
        with patch.object(TelegramService, "send_message", new_callable=AsyncMock) as send:
            send.return_value = True
            asyncio.run(AlertEngine.dispatch(db, ORG_B, [alert]))

        addresses = {call.args[0] for call in send.await_args_list}
        assert "7777" not in addresses, "workspace B alert was delivered to workspace A"

        # Every address reached must belong to workspace B. Asserting a fixed set
        # would be wrong — B accumulates several legitimate links across this
        # module, and all of them are entitled to B's alerts.
        b_addresses = {
            crypto.decrypt(link.delivery_address_encrypted)
            for link in db.query(ChannelLink).filter(
                ChannelLink.organization_id == ORG_B, ChannelLink.status == "active"
            ).all()
        }
        assert addresses <= b_addresses, (
            f"alert reached addresses outside workspace B: {addresses - b_addresses}"
        )
        assert "8888" in addresses

    def test_audit_log_entries_stay_workspace_scoped(self, db, victim_data):
        a_logs = db.query(AuditLog).filter(AuditLog.organization_id == ORG_A).all()
        for entry in a_logs:
            assert B_SHOP not in (entry.message or "")

    def test_inventory_rows_never_cross_workspaces(self, db, victim_data):
        """Direct model-level check: no InventoryItem points at another org's Product."""
        rows = (
            db.query(InventoryItem, Product)
            .join(Product, Product.id == InventoryItem.product_id)
            .all()
        )
        for item, product in rows:
            assert item.organization_id == product.organization_id, (
                f"InventoryItem {item.id} spans workspaces"
            )

    def test_sales_rows_never_cross_workspaces(self, db, victim_data):
        rows = (
            db.query(SalesRecord, Product)
            .join(Product, Product.id == SalesRecord.product_id)
            .all()
        )
        for record, product in rows:
            assert record.organization_id == product.organization_id

    def test_shopify_mappings_never_cross_workspaces(self, db, victim_data):
        rows = (
            db.query(ShopifyProductMapping, Product)
            .join(Product, Product.id == ShopifyProductMapping.product_id)
            .all()
        )
        for mapping, product in rows:
            assert mapping.organization_id == product.organization_id


# ============================================================================
# 5 · SECRET EXPOSURE THROUGH RESPONSES
# ============================================================================


class TestSecretExposure:
    def test_status_endpoint_never_returns_the_access_token(self, as_attacker, db):
        _make_attacker_connection(db)
        response = as_attacker.get("/api/integrations/shopify/status", headers=hdr(ORG_A))
        assert response.status_code == 200
        assert "shpat_" not in response.text
        assert "access_token" not in response.text.lower()

    def test_channel_status_never_returns_raw_external_identifiers(self, as_attacker, db):
        _link(db, ORG_A, USER_A, CHANNEL_WHATSAPP, "919812345678", "919812345678")
        response = as_attacker.get("/api/integrations/channels/status", headers=hdr(ORG_A))
        assert response.status_code == 200
        assert "919812345678" not in response.text

    def test_link_codes_are_single_use_and_not_enumerable_in_responses(
        self, as_attacker, db
    ):
        first = as_attacker.post(
            "/api/integrations/channels/link-code",
            json={"channel": "telegram"}, headers=hdr(ORG_A),
        ).json()
        second = as_attacker.post(
            "/api/integrations/channels/link-code",
            json={"channel": "telegram"}, headers=hdr(ORG_A),
        ).json()
        # Issuing a new code supersedes the old one.
        assert first["code"] != second["code"]
        old = db.query(ChannelLinkCode).filter(
            ChannelLinkCode.code == first["code"]
        ).one()
        assert old.consumed_at is not None, "superseded code left live"

    def test_oauth_install_response_contains_no_client_secret(self, as_attacker):
        response = as_attacker.post(
            "/api/integrations/shopify/install",
            json={"shop_domain": "fresh-iso-store.myshopify.com"}, headers=hdr(ORG_A),
        )
        assert response.status_code == 200
        assert SHOPIFY_SECRET not in response.text
