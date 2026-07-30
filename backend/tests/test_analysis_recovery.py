"""
Tests for analysis failure recovery and the analysis endpoints' tenant scoping.

Two things are covered:

  1. Failure text reaching a merchant is merchant-readable. str(e) used to be
     written straight into analysis_status and rendered in a toast, so a founder's
     first AI run could surface a provider stack trace.
  2. /analysis-status and /analysis/retry are scoped to workspaces the caller
     belongs to. The status endpoint previously fetched any organization by id.
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
from app.config import settings
from app.services.ai.proactive_analysis_service import _friendly_error

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
    """
    Starts from a clean override table — see test_demo_import_guard for why.
    These tests assert tenant scoping, so inheriting another suite's
    get_current_user override would make them meaningless.
    """
    saved = api_app.dependency_overrides.copy()
    api_app.dependency_overrides.clear()
    api_app.dependency_overrides[get_db] = override_get_db
    yield
    api_app.dependency_overrides.clear()
    api_app.dependency_overrides.update(saved)


@pytest.fixture(autouse=True)
def no_background_analysis(monkeypatch):
    from fastapi import BackgroundTasks
    monkeypatch.setattr(BackgroundTasks, "add_task", lambda *a, **k: None)


def _headers(user_id, email, org_id=None):
    token = jwt.encode(
        {"sub": str(user_id), "email": email, "aud": "authenticated", "exp": int(time.time()) + 3600},
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    h = {"Authorization": f"Bearer {token}"}
    if org_id:
        h["X-Workspace-Id"] = str(org_id)
    return h


def _make_user_with_workspace():
    db = TestingSessionLocal()
    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    suffix = uuid.uuid4().hex[:8]
    email = f"founder-{suffix}@brand.com"
    db.add_all([
        Profile(id=user_id, email=email, full_name="Founder", hashed_password="pw"),
        Organization(id=org_id, name="Brand", slug=f"ws-{suffix}"),
        Membership(user_id=user_id, organization_id=org_id, role="owner"),
    ])
    db.commit()
    db.close()
    return {"org_id": org_id, "user_id": user_id, "email": email}


# ---------------------------------------------------------------------------
# Friendly failure text
# ---------------------------------------------------------------------------

def test_budget_cap_explains_itself_without_jargon():
    from app.core.ai_runtime import AIBudgetExceededError
    msg = _friendly_error(AIBudgetExceededError("cap hit", reason="daily_cap"))
    assert "resumes tomorrow" in msg
    assert "cap hit" not in msg


def test_timeout_tells_the_merchant_their_data_is_safe():
    msg = _friendly_error(TimeoutError("deadline exceeded after 30.0s"))
    assert "inventory numbers are unaffected" in msg
    assert "30.0s" not in msg


def test_provider_errors_are_classified_not_echoed():
    """An upstream outage reads as an outage, without the provider's payload."""
    raw = "500 Internal error {'error': {'code': 500, 'status': 'UNAVAILABLE'}} at line 412"
    msg = _friendly_error(RuntimeError(raw))
    assert raw not in msg
    assert "500" not in msg
    assert "couldn't reach the analysis service" in msg


def test_unclassifiable_errors_fall_back_without_leaking():
    """The important one: anything we cannot categorise must still be safe."""
    raw = "psycopg2.ProgrammingError: relation \"foo\" does not exist at 0x7f3a"
    msg = _friendly_error(RuntimeError(raw))
    assert raw not in msg
    assert "psycopg2" not in msg
    assert "0x7f3a" not in msg
    assert "try running the analysis again" in msg


# ---------------------------------------------------------------------------
# Tenant scoping
# ---------------------------------------------------------------------------

def test_analysis_status_hides_another_tenants_workspace():
    victim = _make_user_with_workspace()
    attacker = _make_user_with_workspace()

    resp = TestClient(api_app).get(
        f"/api/organization/{victim['org_id']}/analysis-status",
        headers=_headers(attacker["user_id"], attacker["email"]),
    )

    # 404, not 403 — a non-member should not be able to confirm the id exists.
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_analysis_retry_refuses_another_tenants_workspace():
    victim = _make_user_with_workspace()
    attacker = _make_user_with_workspace()

    resp = TestClient(api_app).post(
        f"/api/organization/{victim['org_id']}/analysis/retry",
        headers=_headers(attacker["user_id"], attacker["email"]),
    )

    assert resp.status_code == status.HTTP_404_NOT_FOUND

    db = TestingSessionLocal()
    org = db.query(Organization).filter(Organization.id == victim["org_id"]).first()
    untouched = org.analysis_status
    db.close()
    assert untouched is None


def test_member_can_retry_their_own_analysis():
    ws = _make_user_with_workspace()

    resp = TestClient(api_app).post(
        f"/api/organization/{ws['org_id']}/analysis/retry",
        headers=_headers(ws["user_id"], ws["email"], ws["org_id"]),
    )

    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["status"] == "in_progress"


def test_retry_does_not_stack_a_second_run():
    """A second retry while one is running would double the recommendations."""
    ws = _make_user_with_workspace()
    client = TestClient(api_app)
    headers = _headers(ws["user_id"], ws["email"], ws["org_id"])

    client.post(f"/api/organization/{ws['org_id']}/analysis/retry", headers=headers)
    second = client.post(f"/api/organization/{ws['org_id']}/analysis/retry", headers=headers)

    assert second.status_code == status.HTTP_200_OK
    assert "already running" in second.json()["message"].lower()


def test_analysis_retry_requires_authentication():
    ws = _make_user_with_workspace()
    resp = TestClient(api_app).post(f"/api/organization/{ws['org_id']}/analysis/retry")
    assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
