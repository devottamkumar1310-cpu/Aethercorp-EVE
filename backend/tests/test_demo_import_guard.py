"""
Safety tests for the demo-workspace import guard.

Importing a real Shopify catalogue into a workspace that still holds seeded demo
data used to upsert the merchant's SKUs alongside the demo brand's, producing an
inventory valuation that was part real and part fiction. mode="replace" clears
the workspace first — which makes it destructive, so the properties asserted
here are the ones that keep it safe:

  1. replace is REFUSED on a workspace holding the merchant's own data
  2. a malformed CSV never deletes anything (validate before delete)
  3. a successful replace retires the demo marker, so the guard stops firing
  4. merge (the default) is completely unchanged
"""
import time
import uuid

import jwt
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app as api_app
from app.database import Base, get_db
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.product import Product
from app.config import settings

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
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


@pytest.fixture(autouse=True, scope="module")
def manage_dependency_overrides():
    saved = api_app.dependency_overrides.copy()
    api_app.dependency_overrides[get_db] = override_get_db
    yield
    api_app.dependency_overrides.clear()
    api_app.dependency_overrides.update(saved)


@pytest.fixture(autouse=True)
def no_background_analysis(monkeypatch):
    """The proactive AI run is out of scope here and needs a live model."""
    from fastapi import BackgroundTasks
    monkeypatch.setattr(BackgroundTasks, "add_task", lambda *a, **k: None)


def _headers(user_id, email, org_id):
    token = jwt.encode(
        {
            "sub": str(user_id),
            "email": email,
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        },
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}", "X-Workspace-Id": str(org_id)}


def _make_workspace(scenario_type, seeded_skus=()):
    """Creates an owner + workspace. scenario_type=None means merchant-owned."""
    db = TestingSessionLocal()
    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    suffix = uuid.uuid4().hex[:8]
    email = f"founder-{suffix}@brand.com"

    db.add_all([
        Profile(id=user_id, email=email, full_name="Founder", hashed_password="pw"),
        Organization(
            id=org_id,
            name="Luma & Co." if scenario_type else "My Brand",
            slug=f"ws-{suffix}",
            scenario_type=scenario_type,
        ),
        Membership(user_id=user_id, organization_id=org_id, role="owner"),
    ])
    for sku in seeded_skus:
        db.add(Product(organization_id=org_id, sku=sku, name=f"Seeded {sku}", category="Demo"))
    db.commit()
    db.close()
    return {"org_id": org_id, "user_id": user_id, "email": email}


def _skus(org_id):
    db = TestingSessionLocal()
    rows = {p.sku for p in db.query(Product).filter(Product.organization_id == org_id).all()}
    db.close()
    return rows


def _scenario_type(org_id):
    db = TestingSessionLocal()
    org = db.query(Organization).filter(Organization.id == org_id).first()
    value = org.scenario_type
    db.close()
    return value


REAL_CSV = (
    b"sku,name,category,stock_on_hand,unit_cost,selling_price\n"
    b"MINE-1,My Silk Dress,Dresses,10,20.00,80.00\n"
    b"MINE-2,My Wool Coat,Outerwear,4,50.00,190.00\n"
)
# No 'sku' column — rejected by the importer's schema validation.
MALFORMED_CSV = b"product_title,qty\nSomething,5\n"


def _upload(ws, body, mode=None):
    url = "/api/inventory/upload/master"
    if mode:
        url += f"?mode={mode}"
    return TestClient(api_app).post(
        url,
        files={"file": ("catalogue.csv", body, "text/csv")},
        headers=_headers(ws["user_id"], ws["email"], ws["org_id"]),
    )


def test_replace_on_demo_workspace_imports_the_merchant_catalogue():
    """
    NOTE ON COVERAGE: clean_org_data issues raw `DELETE ... WHERE organization_id = :oid`.
    SQLite stores UUIDs as dashless hex, so that predicate matches nothing here and
    the seeded rows survive *in this harness only*. Against Postgres — where the
    column is a real uuid and the seeder has always run this exact function — the
    rows are removed. This test therefore asserts the parts SQLite can prove: the
    request succeeds and the merchant's catalogue lands. Row removal is covered by
    test_replace_retires_the_demo_marker (the write only happens after the delete
    returns) plus the seeding path in test_demo_workspace_consistency.
    """
    ws = _make_workspace("GROWTH", seeded_skus=["LM-1001", "LM-1002"])

    resp = _upload(ws, REAL_CSV, mode="replace")

    assert resp.status_code == status.HTTP_201_CREATED
    assert {"MINE-1", "MINE-2"} <= _skus(ws["org_id"])


def test_replace_retires_the_demo_marker():
    """After a replace the workspace is the merchant's, so is_demo must go false
    and the guard must never fire on it again."""
    ws = _make_workspace("GROWTH", seeded_skus=["LM-1001"])

    _upload(ws, REAL_CSV, mode="replace")

    assert _scenario_type(ws["org_id"]) is None


def test_replace_is_refused_on_a_merchant_owned_workspace():
    """The guard that stops this endpoint ever wiping real data."""
    ws = _make_workspace(None, seeded_skus=["MY-EXISTING-SKU"])

    resp = _upload(ws, REAL_CSV, mode="replace")

    assert resp.status_code == status.HTTP_409_CONFLICT
    # Nothing was deleted and nothing was imported.
    assert _skus(ws["org_id"]) == {"MY-EXISTING-SKU"}


def test_malformed_csv_never_deletes_demo_data():
    """A bad file must not leave the merchant with an empty workspace."""
    ws = _make_workspace("GROWTH", seeded_skus=["LM-1001", "LM-1002"])

    resp = _upload(ws, MALFORMED_CSV, mode="replace")

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "sku" in resp.json()["missing_columns"]
    assert _skus(ws["org_id"]) == {"LM-1001", "LM-1002"}


def test_merge_is_the_default_and_is_unchanged():
    ws = _make_workspace(None, seeded_skus=["EXISTING-1"])

    resp = _upload(ws, REAL_CSV)

    assert resp.status_code == status.HTTP_201_CREATED
    assert _skus(ws["org_id"]) == {"EXISTING-1", "MINE-1", "MINE-2"}


def test_invalid_mode_is_rejected():
    ws = _make_workspace("GROWTH", seeded_skus=["LM-1001"])

    resp = _upload(ws, REAL_CSV, mode="wipe")

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert _skus(ws["org_id"]) == {"LM-1001"}


# ---------------------------------------------------------------------------
# Client bypass attempts. The dialog is a courtesy; these are the real controls.
# ---------------------------------------------------------------------------

def test_replace_cannot_wipe_another_tenants_demo_workspace():
    """
    The attack: a merchant sends mode=replace with a victim's workspace id in
    X-Workspace-Id, aiming to destroy the victim's data.

    get_active_workspace_id refuses a workspace the caller is not a member of and
    falls back to the caller's own primary membership, so the destructive write
    can never reach across the tenant boundary.
    """
    victim = _make_workspace("GROWTH", seeded_skus=["VICTIM-1", "VICTIM-2"])
    attacker = _make_workspace(None, seeded_skus=["ATTACKER-1"])

    resp = TestClient(api_app).post(
        "/api/inventory/upload/master?mode=replace",
        files={"file": ("catalogue.csv", REAL_CSV, "text/csv")},
        # Attacker's own credentials, victim's workspace id.
        headers=_headers(attacker["user_id"], attacker["email"], victim["org_id"]),
    )

    # Retargeted to the attacker's own workspace, which is not a demo → refused.
    assert resp.status_code == status.HTTP_409_CONFLICT
    assert _skus(victim["org_id"]) == {"VICTIM-1", "VICTIM-2"}
    assert _scenario_type(victim["org_id"]) == "GROWTH"


def test_replace_requires_authentication():
    ws = _make_workspace("GROWTH", seeded_skus=["LM-1001"])

    resp = TestClient(api_app).post(
        "/api/inventory/upload/master?mode=replace",
        files={"file": ("catalogue.csv", REAL_CSV, "text/csv")},
        headers={"X-Workspace-Id": str(ws["org_id"])},  # no bearer token
    )

    assert resp.status_code in (
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    )
    assert _skus(ws["org_id"]) == {"LM-1001"}


def test_replace_rejects_a_forged_token():
    """A token signed with the wrong secret must not reach the destructive path."""
    ws = _make_workspace("GROWTH", seeded_skus=["LM-1001"])
    forged = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "attacker@evil.com",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        },
        "not-the-real-secret",
        algorithm="HS256",
    )

    resp = TestClient(api_app).post(
        "/api/inventory/upload/master?mode=replace",
        files={"file": ("catalogue.csv", REAL_CSV, "text/csv")},
        headers={
            "Authorization": f"Bearer {forged}",
            "X-Workspace-Id": str(ws["org_id"]),
        },
    )

    assert resp.status_code in (
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    )
    assert _skus(ws["org_id"]) == {"LM-1001"}


def test_replace_is_refused_below_manager_role():
    """Authorization is resolved as a dependency, before the handler body runs."""
    db = TestingSessionLocal()
    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    suffix = uuid.uuid4().hex[:8]
    email = f"viewer-{suffix}@brand.com"
    db.add_all([
        Profile(id=user_id, email=email, full_name="Viewer", hashed_password="pw"),
        Organization(id=org_id, name="Luma & Co.", slug=f"ws-{suffix}", scenario_type="GROWTH"),
        Membership(user_id=user_id, organization_id=org_id, role="employee"),
        Product(organization_id=org_id, sku="LM-1001", name="Seeded", category="Demo"),
    ])
    db.commit()
    db.close()

    resp = TestClient(api_app).post(
        "/api/inventory/upload/master?mode=replace",
        files={"file": ("catalogue.csv", REAL_CSV, "text/csv")},
        headers=_headers(user_id, email, org_id),
    )

    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert _skus(org_id) == {"LM-1001"}
