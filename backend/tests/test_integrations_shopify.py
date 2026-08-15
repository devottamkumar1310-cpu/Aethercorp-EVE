# ==============================================================================
# PURPOSE: Shopify integration test suite.
# COVERS: OAuth install/state/callback, HMAC verification, webhook authentication
#         and idempotency, synchronisation mapping, sync idempotency, credential
#         encryption, tenant isolation, and failure handling.
# ==============================================================================

import base64
import datetime
import hashlib
import hmac
import json
import uuid
from urllib.parse import urlencode

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core import crypto
from app.database import Base, get_db
from app.main import app
from app.models.inventory import InventoryItem, SalesRecord
from app.models.organization import Membership, Organization
from app.models.product import Product
from app.models.profile import Profile
from app.models.shopify import (
    ShopifyConnection,
    ShopifyOAuthState,
    ShopifyProductMapping,
    ShopifyWebhookEvent,
)
from app.core.security import get_current_user
from app.services.shopify.client import normalize_shop_domain
from app.services.shopify.oauth_service import ShopifyOAuthService
from app.services.shopify.sync_service import ShopifySyncService
from app.services.shopify.webhook_service import (
    ShopifyWebhookService,
    verify_webhook_hmac,
)

# ---------------------------------------------------------------- test fixtures

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

TEST_API_SECRET = "shpss_test_secret_for_hmac_verification"

ORG_A_ID = uuid.uuid4()
ORG_B_ID = uuid.uuid4()
USER_A_ID = uuid.uuid4()
USER_B_ID = uuid.uuid4()

_seed = TestingSessionLocal()
_seed.add_all(
    [
        Profile(id=USER_A_ID, email="a@example.com", full_name="A", hashed_password="x"),
        Profile(id=USER_B_ID, email="b@example.com", full_name="B", hashed_password="x"),
        Organization(id=ORG_A_ID, name="Org A", slug="org-a-shopify"),
        Organization(id=ORG_B_ID, name="Org B", slug="org-b-shopify"),
        Membership(user_id=USER_A_ID, organization_id=ORG_A_ID, role="owner"),
        Membership(user_id=USER_B_ID, organization_id=ORG_B_ID, role="owner"),
    ]
)
_seed.commit()
_seed.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def bind_test_database():
    """
    Gives each test a clean, hermetic dependency graph bound to THIS module's engine.

    `app` is a singleton shared by every test file, and several existing modules
    install overrides at IMPORT time — including get_required_workspace_id pinned
    to their own fixed org. Those leak into any module that runs after them and
    would make this module's X-Workspace-Id header a no-op (every request would
    resolve to the other module's workspace and 403). Snapshotting and restoring
    the whole mapping keeps this suite order-independent without changing how the
    other modules behave.
    """
    snapshot = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(snapshot)


@pytest.fixture(autouse=True)
def shopify_credentials(monkeypatch):
    """Gives every test a deterministic app secret and a stable encryption key."""
    monkeypatch.setattr(settings, "SHOPIFY_API_KEY", "test-client-id")
    monkeypatch.setattr(settings, "SHOPIFY_API_SECRET", TEST_API_SECRET)
    monkeypatch.setattr(settings, "BACKEND_PUBLIC_URL", "https://eve.example.com")
    monkeypatch.setattr(settings, "INTEGRATION_ENCRYPTION_KEY", "unit-test-encryption-key")
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


@pytest.fixture
def client_as_a():
    app.dependency_overrides[get_current_user] = lambda: _profile(USER_A_ID)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def client_as_b():
    app.dependency_overrides[get_current_user] = lambda: _profile(USER_B_ID)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_current_user, None)


def _profile(user_id):
    session = TestingSessionLocal()
    try:
        return session.query(Profile).filter(Profile.id == user_id).first()
    finally:
        session.close()


def _headers(org_id):
    return {"Authorization": "Bearer test", "X-Workspace-Id": str(org_id)}


@pytest.fixture
def fresh_workspace():
    """
    A workspace that provably has no Shopify connection.

    The shared ORG_A/ORG_B fixtures accumulate connections as the suite runs, so
    "no connection" assertions must not depend on test ordering.
    """
    session = TestingSessionLocal()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    try:
        session.add_all(
            [
                Profile(
                    id=user_id,
                    email=f"fresh-{user_id.hex[:8]}@example.com",
                    full_name="Fresh",
                    hashed_password="x",
                ),
                Organization(
                    id=org_id, name="Fresh Org", slug=f"fresh-org-{org_id.hex[:8]}"
                ),
                Membership(user_id=user_id, organization_id=org_id, role="owner"),
            ]
        )
        session.commit()
        profile = session.query(Profile).filter(Profile.id == user_id).first()
    finally:
        session.close()

    app.dependency_overrides[get_current_user] = lambda: profile
    with TestClient(app) as test_client:
        yield test_client, org_id
    app.dependency_overrides.pop(get_current_user, None)


def _make_connection(db, org_id, shop_domain, token="shpat_live_token"):
    connection = ShopifyConnection(
        organization_id=org_id,
        shop_domain=shop_domain,
        access_token_encrypted=crypto.encrypt(token),
        scopes="read_products,read_inventory,read_orders",
        api_version="2024-07",
        status="connected",
        sync_status="idle",
        webhook_ids=[],
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow(),
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


# ------------------------------------------------------------ domain validation


class TestShopDomainValidation:
    def test_accepts_valid_myshopify_domain(self):
        assert normalize_shop_domain("Acme-Store.myshopify.com") == "acme-store.myshopify.com"

    def test_strips_scheme_and_path(self):
        assert (
            normalize_shop_domain("https://acme.myshopify.com/admin")
            == "acme.myshopify.com"
        )

    @pytest.mark.parametrize(
        "value",
        [
            "evil.com",
            "acme.myshopify.com.evil.com",
            "acme.shopify.com",
            "",
            ".myshopify.com",
            "under_score.myshopify.com",
        ],
    )
    def test_rejects_non_shopify_domains(self, value):
        # The domain is used to build the URL the access token is sent to, so an
        # attacker-controlled host here would exfiltrate the merchant's credential.
        assert normalize_shop_domain(value) is None


# ---------------------------------------------------------------------- OAuth


class TestShopifyOAuth:
    def test_install_requires_valid_domain(self, client_as_a):
        response = client_as_a.post(
            "/api/integrations/shopify/install",
            json={"shop_domain": "evil.com"},
            headers=_headers(ORG_A_ID),
        )
        assert response.status_code == 400

    def test_install_returns_authorize_url_and_persists_state(self, client_as_a, db):
        response = client_as_a.post(
            "/api/integrations/shopify/install",
            json={"shop_domain": "install-test.myshopify.com"},
            headers=_headers(ORG_A_ID),
        )
        assert response.status_code == 200
        url = response.json()["authorize_url"]
        assert url.startswith("https://install-test.myshopify.com/admin/oauth/authorize")
        assert "client_id=test-client-id" in url

        state = (
            db.query(ShopifyOAuthState)
            .filter(ShopifyOAuthState.shop_domain == "install-test.myshopify.com")
            .first()
        )
        assert state is not None
        assert state.organization_id == ORG_A_ID
        assert state.consumed_at is None

    def test_install_rejected_when_shop_owned_by_another_workspace(
        self, client_as_b, db
    ):
        _make_connection(db, ORG_A_ID, "taken-shop.myshopify.com")
        response = client_as_b.post(
            "/api/integrations/shopify/install",
            json={"shop_domain": "taken-shop.myshopify.com"},
            headers=_headers(ORG_B_ID),
        )
        assert response.status_code == 409

    def test_callback_hmac_verification(self):
        params = {"code": "abc", "shop": "acme.myshopify.com", "state": "xyz"}
        message = urlencode(sorted(params.items()))
        params["hmac"] = hmac.new(
            TEST_API_SECRET.encode(), message.encode(), hashlib.sha256
        ).hexdigest()

        assert ShopifyOAuthService.verify_callback_hmac(params) is True

        params["code"] = "tampered"
        assert ShopifyOAuthService.verify_callback_hmac(params) is False

    def test_callback_rejects_missing_hmac(self):
        assert (
            ShopifyOAuthService.verify_callback_hmac({"shop": "acme.myshopify.com"})
            is False
        )

    def test_state_is_single_use(self, db):
        state = ShopifyOAuthService.create_state(
            db, ORG_A_ID, USER_A_ID, "single-use.myshopify.com"
        )
        first = ShopifyOAuthService.consume_state(db, state, "single-use.myshopify.com")
        assert first is not None

        # Replaying a captured callback URL must not succeed a second time.
        second = ShopifyOAuthService.consume_state(db, state, "single-use.myshopify.com")
        assert second is None

    def test_state_rejects_shop_mismatch(self, db):
        state = ShopifyOAuthService.create_state(
            db, ORG_A_ID, USER_A_ID, "mine.myshopify.com"
        )
        assert ShopifyOAuthService.consume_state(db, state, "other.myshopify.com") is None

    def test_expired_state_is_rejected(self, db):
        state = ShopifyOAuthService.create_state(
            db, ORG_A_ID, USER_A_ID, "expired.myshopify.com"
        )
        record = (
            db.query(ShopifyOAuthState).filter(ShopifyOAuthState.state == state).first()
        )
        record.expires_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=1)
        db.commit()

        assert ShopifyOAuthService.consume_state(db, state, "expired.myshopify.com") is None

    def test_callback_with_invalid_signature_redirects_to_error(self, client_as_a):
        response = client_as_a.get(
            "/api/integrations/shopify/callback",
            params={
                "shop": "acme.myshopify.com",
                "code": "abc",
                "state": "nope",
                "hmac": "deadbeef",
            },
            follow_redirects=False,
        )
        assert response.status_code == 307
        assert "shopify=error" in response.headers["location"]
        assert "invalid_signature" in response.headers["location"]

    def test_callback_with_valid_hmac_but_unknown_state_is_rejected(self, client_as_a):
        params = {
            "shop": "acme.myshopify.com",
            "code": "abc",
            "state": "not-a-real-state",
            "timestamp": "1",
        }
        message = urlencode(sorted(params.items()))
        params["hmac"] = hmac.new(
            TEST_API_SECRET.encode(), message.encode(), hashlib.sha256
        ).hexdigest()

        response = client_as_a.get(
            "/api/integrations/shopify/callback", params=params, follow_redirects=False
        )
        assert response.status_code == 307
        assert "invalid_state" in response.headers["location"]

    def test_connection_stores_token_encrypted(self, db):
        connection = ShopifyOAuthService.upsert_connection(
            db, ORG_A_ID, USER_A_ID, "crypt.myshopify.com", "shpat_secret_value", "read_products"
        )
        # The raw token must never be readable from the column.
        assert "shpat_secret_value" not in connection.access_token_encrypted
        assert crypto.decrypt(connection.access_token_encrypted) == "shpat_secret_value"

    def test_upsert_refuses_cross_workspace_takeover(self, db):
        from app.services.shopify.oauth_service import ShopifyOAuthError

        ShopifyOAuthService.upsert_connection(
            db, ORG_A_ID, USER_A_ID, "contested.myshopify.com", "token-a", ""
        )
        with pytest.raises(ShopifyOAuthError):
            ShopifyOAuthService.upsert_connection(
                db, ORG_B_ID, USER_B_ID, "contested.myshopify.com", "token-b", ""
            )


# -------------------------------------------------------------------- webhooks


def _sign(body: bytes) -> str:
    return base64.b64encode(
        hmac.new(TEST_API_SECRET.encode(), body, hashlib.sha256).digest()
    ).decode()


class TestShopifyWebhookAuth:
    def test_valid_signature_accepted(self):
        body = b'{"id": 1}'
        assert verify_webhook_hmac(body, _sign(body)) is True

    def test_tampered_body_rejected(self):
        assert verify_webhook_hmac(b'{"id": 2}', _sign(b'{"id": 1}')) is False

    def test_missing_signature_rejected(self):
        assert verify_webhook_hmac(b'{"id": 1}', None) is False

    def test_webhook_endpoint_rejects_unsigned_request(self, client_as_a):
        response = client_as_a.post(
            "/api/integrations/shopify/webhook",
            content=b'{"id": 1}',
            headers={
                "X-Shopify-Topic": "products/update",
                "X-Shopify-Shop-Domain": "acme.myshopify.com",
                "X-Shopify-Webhook-Id": "wh-unsigned",
            },
        )
        assert response.status_code == 401

    def test_webhook_requires_delivery_id(self, client_as_a):
        body = b'{"id": 1}'
        response = client_as_a.post(
            "/api/integrations/shopify/webhook",
            content=body,
            headers={
                "X-Shopify-Topic": "products/update",
                "X-Shopify-Shop-Domain": "acme.myshopify.com",
                "X-Shopify-Hmac-Sha256": _sign(body),
            },
        )
        assert response.status_code == 400


class TestShopifyWebhookIdempotency:
    def test_duplicate_webhook_id_is_ignored(self, client_as_a, db):
        _make_connection(db, ORG_A_ID, "idem-shop.myshopify.com")
        payload = {
            "id": 900001,
            "title": "Idempotency Tee",
            "product_type": "Tops",
            "options": [{"position": 1, "name": "Size"}],
            "variants": [
                {
                    "id": 500001,
                    "sku": "IDEM-TEE-M",
                    "option1": "M",
                    "price": "40.00",
                    "inventory_item_id": 700001,
                }
            ],
        }
        body = json.dumps(payload).encode()
        headers = {
            "X-Shopify-Topic": "products/update",
            "X-Shopify-Shop-Domain": "idem-shop.myshopify.com",
            "X-Shopify-Webhook-Id": "wh-duplicate-1",
            "X-Shopify-Hmac-Sha256": _sign(body),
        }

        first = client_as_a.post(
            "/api/integrations/shopify/webhook", content=body, headers=headers
        )
        assert first.json()["status"] == "processed"

        second = client_as_a.post(
            "/api/integrations/shopify/webhook", content=body, headers=headers
        )
        assert second.json()["status"] == "duplicate"

        # Exactly one ledger row, and exactly one product — not two.
        events = (
            db.query(ShopifyWebhookEvent)
            .filter(ShopifyWebhookEvent.webhook_id == "wh-duplicate-1")
            .all()
        )
        assert len(events) == 1

        products = (
            db.query(Product)
            .filter(Product.organization_id == ORG_A_ID, Product.sku == "IDEM-TEE-M")
            .all()
        )
        assert len(products) == 1

    def test_webhook_for_unknown_shop_is_ignored_not_applied(self, client_as_a, db):
        body = json.dumps({"id": 1, "title": "Ghost"}).encode()
        response = client_as_a.post(
            "/api/integrations/shopify/webhook",
            content=body,
            headers={
                "X-Shopify-Topic": "products/update",
                "X-Shopify-Shop-Domain": "never-connected.myshopify.com",
                "X-Shopify-Webhook-Id": "wh-unknown-shop",
                "X-Shopify-Hmac-Sha256": _sign(body),
            },
        )
        assert response.json()["status"] == "ignored"

    def test_uninstall_webhook_marks_connection_disconnected(self, client_as_a, db):
        connection = _make_connection(db, ORG_A_ID, "uninstall-me.myshopify.com")
        body = json.dumps({"id": 1}).encode()

        client_as_a.post(
            "/api/integrations/shopify/webhook",
            content=body,
            headers={
                "X-Shopify-Topic": "app/uninstalled",
                "X-Shopify-Shop-Domain": "uninstall-me.myshopify.com",
                "X-Shopify-Webhook-Id": "wh-uninstall-1",
                "X-Shopify-Hmac-Sha256": _sign(body),
            },
        )

        db.refresh(connection)
        assert connection.status == "disconnected"


# ------------------------------------------------------------------ sync logic


SAMPLE_PRODUCT = {
    "id": 111,
    "title": "Black Denim Jacket",
    "product_type": "Outerwear",
    "options": [{"position": 1, "name": "Size"}, {"position": 2, "name": "Color"}],
    "variants": [
        {
            "id": 2001,
            "sku": "BDJ-M-BLK",
            "option1": "M",
            "option2": "Black",
            "price": "129.00",
            "inventory_item_id": 3001,
        },
        {
            "id": 2002,
            "sku": "BDJ-L-BLK",
            "option1": "L",
            "option2": "Black",
            "price": "129.00",
            "inventory_item_id": 3002,
        },
    ],
}


class TestShopifySync:
    def test_products_map_into_canonical_eve_models(self, db):
        connection = _make_connection(db, ORG_A_ID, "sync-products.myshopify.com")
        products, variants = ShopifySyncService.upsert_products(
            db, connection, [SAMPLE_PRODUCT]
        )

        assert products == 1
        assert variants == 2

        rows = (
            db.query(Product)
            .filter(
                Product.organization_id == ORG_A_ID,
                Product.sku.in_(["BDJ-M-BLK", "BDJ-L-BLK"]),
            )
            .all()
        )
        assert len(rows) == 2
        medium = next(row for row in rows if row.sku == "BDJ-M-BLK")
        assert medium.size == "M"
        assert medium.color == "Black"
        assert medium.category == "Outerwear"
        assert medium.selling_price == 129.00
        # Shopify does not expose COGS; unit_cost must stay 0 rather than be invented.
        assert medium.unit_cost == 0.0

        mappings = (
            db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.organization_id == ORG_A_ID)
            .all()
        )
        assert {m.shopify_variant_id for m in mappings} >= {"2001", "2002"}
        assert {m.shopify_inventory_item_id for m in mappings} >= {"3001", "3002"}

    def test_product_sync_is_idempotent(self, db):
        connection = _make_connection(db, ORG_A_ID, "sync-idem.myshopify.com")

        ShopifySyncService.upsert_products(db, connection, [SAMPLE_PRODUCT])
        first_count = (
            db.query(Product)
            .filter(Product.organization_id == ORG_A_ID, Product.sku.like("BDJ-%"))
            .count()
        )

        ShopifySyncService.upsert_products(db, connection, [SAMPLE_PRODUCT])
        second_count = (
            db.query(Product)
            .filter(Product.organization_id == ORG_A_ID, Product.sku.like("BDJ-%"))
            .count()
        )

        assert first_count == second_count

    def test_inventory_levels_sum_across_locations(self, db):
        connection = _make_connection(db, ORG_A_ID, "sync-inventory.myshopify.com")
        ShopifySyncService.upsert_products(db, connection, [SAMPLE_PRODUCT])

        synced = ShopifySyncService.upsert_inventory_levels(
            db,
            connection,
            [
                {"inventory_item_id": 3001, "available": 12, "location_id": 1},
                {"inventory_item_id": 3001, "available": 8, "location_id": 2},
                {"inventory_item_id": 3002, "available": 5, "location_id": 1},
            ],
        )
        assert synced == 2

        mapping = (
            db.query(ShopifyProductMapping)
            .filter(
                ShopifyProductMapping.organization_id == ORG_A_ID,
                ShopifyProductMapping.shopify_inventory_item_id == "3001",
            )
            .first()
        )
        item = (
            db.query(InventoryItem)
            .filter(InventoryItem.product_id == mapping.product_id)
            .first()
        )
        assert item.stock_on_hand == 20

    def test_null_availability_does_not_zero_stock(self, db):
        connection = _make_connection(db, ORG_A_ID, "sync-null.myshopify.com")
        ShopifySyncService.upsert_products(db, connection, [SAMPLE_PRODUCT])
        ShopifySyncService.upsert_inventory_levels(
            db, connection, [{"inventory_item_id": 3001, "available": 15}]
        )

        # An untracked item reports null. Treating that as 0 would raise a false
        # stockout alarm on a product that is actually in stock.
        ShopifySyncService.upsert_inventory_levels(
            db, connection, [{"inventory_item_id": 3001, "available": None}]
        )

        mapping = (
            db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.shopify_inventory_item_id == "3001")
            .first()
        )
        item = (
            db.query(InventoryItem)
            .filter(InventoryItem.product_id == mapping.product_id)
            .first()
        )
        assert item.stock_on_hand == 15

    def test_orders_become_sales_records_and_resync_does_not_double_count(self, db):
        connection = _make_connection(db, ORG_A_ID, "sync-orders.myshopify.com")
        ShopifySyncService.upsert_products(db, connection, [SAMPLE_PRODUCT])

        order = {
            "id": 9001,
            "created_at": "2026-08-01T10:00:00Z",
            "financial_status": "paid",
            "line_items": [
                {"id": 1, "sku": "BDJ-M-BLK", "quantity": 3, "price": "129.00"}
            ],
            "refunds": [],
        }

        ShopifySyncService.upsert_orders(db, connection, [order])
        mapping = (
            db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.sku == "BDJ-M-BLK")
            .first()
        )
        rows = (
            db.query(SalesRecord)
            .filter(
                SalesRecord.organization_id == ORG_A_ID,
                SalesRecord.product_id == mapping.product_id,
                SalesRecord.date == datetime.date(2026, 8, 1),
            )
            .all()
        )
        assert len(rows) == 1
        assert rows[0].quantity == 3
        assert rows[0].revenue == pytest.approx(387.0)

        # Re-running the same order must restate the day, not add to it. Appending
        # would inflate sell-through and every figure derived from it.
        ShopifySyncService.upsert_orders(db, connection, [order])
        rows = (
            db.query(SalesRecord)
            .filter(
                SalesRecord.organization_id == ORG_A_ID,
                SalesRecord.product_id == mapping.product_id,
                SalesRecord.date == datetime.date(2026, 8, 1),
            )
            .all()
        )
        assert len(rows) == 1
        assert rows[0].quantity == 3

    def test_refunded_quantity_is_netted_out(self, db):
        connection = _make_connection(db, ORG_A_ID, "sync-refunds.myshopify.com")
        ShopifySyncService.upsert_products(db, connection, [SAMPLE_PRODUCT])

        ShopifySyncService.upsert_orders(
            db,
            connection,
            [
                {
                    "id": 9100,
                    "created_at": "2026-08-05T10:00:00Z",
                    "financial_status": "partially_refunded",
                    "line_items": [
                        {"id": 77, "sku": "BDJ-L-BLK", "quantity": 5, "price": "129.00"}
                    ],
                    "refunds": [
                        {"refund_line_items": [{"line_item_id": 77, "quantity": 2}]}
                    ],
                }
            ],
        )

        mapping = (
            db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.sku == "BDJ-L-BLK")
            .first()
        )
        row = (
            db.query(SalesRecord)
            .filter(
                SalesRecord.product_id == mapping.product_id,
                SalesRecord.date == datetime.date(2026, 8, 5),
            )
            .first()
        )
        assert row.quantity == 3

    def test_unmapped_sku_is_skipped_not_guessed(self, db):
        connection = _make_connection(db, ORG_A_ID, "sync-unmapped.myshopify.com")
        ShopifySyncService.upsert_products(db, connection, [SAMPLE_PRODUCT])

        _, written = ShopifySyncService.upsert_orders(
            db,
            connection,
            [
                {
                    "id": 9200,
                    "created_at": "2026-08-06T10:00:00Z",
                    "financial_status": "paid",
                    "line_items": [
                        {"id": 1, "sku": "NOT-IN-EVE", "quantity": 4, "price": "10.00"}
                    ],
                    "refunds": [],
                }
            ],
        )
        # Attributing a sale to the wrong product is worse than omitting it.
        assert written == 0


# -------------------------------------------------------------- tenant isolation


class TestShopifyTenantIsolation:
    def test_status_only_shows_own_workspace_connection(self, client_as_b, db):
        _make_connection(db, ORG_A_ID, "isolation-a.myshopify.com")

        response = client_as_b.get(
            "/api/integrations/shopify/status", headers=_headers(ORG_B_ID)
        )
        assert response.status_code == 200
        assert response.json()["connected"] is False
        assert response.json()["shop_domain"] is None

    def test_user_cannot_read_another_workspace_via_header(self, client_as_b, db):
        _make_connection(db, ORG_A_ID, "isolation-header.myshopify.com")

        # User B is not a member of Org A; the workspace dependency must refuse.
        response = client_as_b.get(
            "/api/integrations/shopify/status", headers=_headers(ORG_A_ID)
        )
        assert response.status_code == 403

    def test_sync_of_one_workspace_does_not_touch_another(self, db):
        connection_a = _make_connection(db, ORG_A_ID, "tenant-a-sync.myshopify.com")
        connection_b = _make_connection(db, ORG_B_ID, "tenant-b-sync.myshopify.com")

        ShopifySyncService.upsert_products(db, connection_a, [SAMPLE_PRODUCT])
        ShopifySyncService.upsert_products(db, connection_b, [SAMPLE_PRODUCT])

        mappings_a = (
            db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.organization_id == ORG_A_ID)
            .all()
        )
        mappings_b = (
            db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.organization_id == ORG_B_ID)
            .all()
        )
        # Same Shopify variant ids, but two entirely separate product sets.
        assert {m.product_id for m in mappings_a}.isdisjoint(
            {m.product_id for m in mappings_b}
        )

    def test_disconnect_requires_admin_membership(self, client_as_b, db):
        _make_connection(db, ORG_A_ID, "no-cross-disconnect.myshopify.com")
        response = client_as_b.request(
            "DELETE",
            "/api/integrations/shopify/disconnect",
            headers=_headers(ORG_A_ID),
        )
        assert response.status_code == 403

    def test_webhook_workspace_comes_from_shop_domain_not_payload(self, db):
        """A forged organization_id in the body must not redirect the write."""
        _make_connection(db, ORG_A_ID, "resolve-owner.myshopify.com")
        connection = ShopifyWebhookService.resolve_connection(
            db, "resolve-owner.myshopify.com"
        )
        assert connection.organization_id == ORG_A_ID


# ------------------------------------------------------------- missing / errors


class TestShopifyFailureHandling:
    def test_sync_without_connection_returns_404(self, fresh_workspace):
        client, org_id = fresh_workspace
        response = client.post(
            "/api/integrations/shopify/sync", headers=_headers(org_id)
        )
        assert response.status_code == 404

    def test_disconnect_without_connection_returns_404(self, fresh_workspace):
        client, org_id = fresh_workspace
        response = client.request(
            "DELETE", "/api/integrations/shopify/disconnect", headers=_headers(org_id)
        )
        assert response.status_code == 404

    def test_status_reports_not_connected_for_fresh_workspace(self, fresh_workspace):
        client, org_id = fresh_workspace
        response = client.get(
            "/api/integrations/shopify/status", headers=_headers(org_id)
        )
        assert response.status_code == 200
        body = response.json()
        assert body["connected"] is False
        assert body["recent_jobs"] == []

    def test_install_blocked_when_app_not_configured(self, client_as_a, monkeypatch):
        monkeypatch.setattr(settings, "SHOPIFY_API_KEY", "")
        monkeypatch.setattr(settings, "SHOPIFY_API_SECRET", "")
        response = client_as_a.post(
            "/api/integrations/shopify/install",
            json={"shop_domain": "acme.myshopify.com"},
            headers=_headers(ORG_A_ID),
        )
        assert response.status_code == 503

    def test_unauthenticated_request_is_rejected(self):
        app.dependency_overrides.pop(get_current_user, None)
        with TestClient(app) as anon:
            response = anon.get("/api/integrations/shopify/status")
        assert response.status_code == 401

    def test_decrypting_with_wrong_key_raises_rather_than_returning_blank(self, db):
        connection = _make_connection(db, ORG_A_ID, "badkey.myshopify.com", "tok")
        ciphertext = connection.access_token_encrypted

        settings.INTEGRATION_ENCRYPTION_KEY = "a-completely-different-key"
        crypto.reset_cipher_cache()
        try:
            with pytest.raises(crypto.CredentialDecryptionError):
                crypto.decrypt(ciphertext)
        finally:
            settings.INTEGRATION_ENCRYPTION_KEY = "unit-test-encryption-key"
            crypto.reset_cipher_cache()
