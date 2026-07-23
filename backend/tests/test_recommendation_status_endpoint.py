# ==============================================================================
# PURPOSE: Regression tests for PATCH /api/recommendations/{id}/status — the
#          persistence endpoint behind Mark as Ordered / Ignore (Reorder Center)
#          and Accept / Dismiss (Recommendation History). Guards against three
#          release blockers: the action not persisting, not writing an Activity
#          Log entry, and not being scoped to the caller's own workspace.
# ==============================================================================

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi import Depends

from app.main import app
from app.database import Base, get_db
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.models.recommendation_trace import RecommendationTrace
from app.models.recommendation_audit_event import RecommendationAuditEvent
from app.models.activity_log import ActivityLog
from app.services.recommendation_trace_service import RecommendationTraceService
from app.core.security import get_current_user

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

active_test_user_id = None


def mock_get_current_user(db: Session = Depends(get_db)):
    global active_test_user_id
    return db.query(Profile).filter(Profile.id == active_test_user_id).first()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_overrides():
    old_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)


def _make_org_and_user(db, email):
    org = Organization(id=uuid.uuid4(), name="Status Test Co", slug=f"status-test-{uuid.uuid4().hex[:8]}")
    user = Profile(id=uuid.uuid4(), email=email, full_name="Test Founder", hashed_password="pw")
    db.add(org)
    db.add(user)
    db.flush()
    db.add(Membership(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="owner"))
    db.commit()
    return org, user


@pytest.fixture
def workspace():
    db = TestingSessionLocal()
    org, user = _make_org_and_user(db, f"founder-{uuid.uuid4().hex[:8]}@test.com")
    trace = RecommendationTraceService.create_trace(
        db=db,
        org_id=org.id,
        rec_type="reorder",
        action="Reorder 100 units of Test Widget",
        confidence=0.9,
        sources=["inventory_ledger"],
        metrics={"stock": 5, "threshold": 50},
        reasoning=["Stock below threshold."],
    )
    trace.related_skus = ["SKU-TEST-1"]
    db.commit()
    trace_id = trace.id
    org_id = org.id
    user_id = user.id
    db.close()
    return {"org_id": org_id, "user_id": user_id, "trace_id": trace_id}


def test_status_update_persists_and_creates_audit_event(workspace):
    global active_test_user_id
    active_test_user_id = workspace["user_id"]
    client = TestClient(app)
    headers = {"X-Workspace-Id": str(workspace["org_id"])}

    resp = client.patch(
        f"/api/recommendations/{workspace['trace_id']}/status",
        headers=headers,
        json={"status": "Completed"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "Completed"

    db = TestingSessionLocal()
    try:
        trace = db.query(RecommendationTrace).filter(RecommendationTrace.id == workspace["trace_id"]).first()
        assert trace.status == "Completed"

        events = db.query(RecommendationAuditEvent).filter(
            RecommendationAuditEvent.trace_id == workspace["trace_id"]
        ).all()
        update_events = [e for e in events if e.event_type == "UPDATED"]
        assert len(update_events) == 1
        assert update_events[0].details["new_status"] == "Completed"
    finally:
        db.close()


def test_status_update_writes_activity_log_entry_with_sku(workspace):
    global active_test_user_id
    active_test_user_id = workspace["user_id"]
    client = TestClient(app)
    headers = {"X-Workspace-Id": str(workspace["org_id"])}

    resp = client.patch(
        f"/api/recommendations/{workspace['trace_id']}/status",
        headers=headers,
        json={"status": "Dismissed"},
    )
    assert resp.status_code == 200

    db = TestingSessionLocal()
    try:
        logs = db.query(ActivityLog).filter(
            ActivityLog.organization_id == workspace["org_id"]
        ).all()
        assert len(logs) == 1
        assert logs[0].entity_type == "RecommendationRejected"
        assert logs[0].action == "REJECT"
        assert "SKU-TEST-1" in logs[0].description
    finally:
        db.close()


def test_status_update_rejects_invalid_status(workspace):
    global active_test_user_id
    active_test_user_id = workspace["user_id"]
    client = TestClient(app)
    headers = {"X-Workspace-Id": str(workspace["org_id"])}

    resp = client.patch(
        f"/api/recommendations/{workspace['trace_id']}/status",
        headers=headers,
        json={"status": "NotARealStatus"},
    )
    assert resp.status_code == 400


def test_status_update_404s_for_unknown_trace(workspace):
    global active_test_user_id
    active_test_user_id = workspace["user_id"]
    client = TestClient(app)
    headers = {"X-Workspace-Id": str(workspace["org_id"])}

    resp = client.patch(
        f"/api/recommendations/{uuid.uuid4()}/status",
        headers=headers,
        json={"status": "Completed"},
    )
    assert resp.status_code == 404


def test_status_update_is_scoped_to_the_caller_workspace(workspace):
    """A trace belonging to a different organization must not be patchable
    just because the caller happens to know its id — cross-tenant isolation."""
    db = TestingSessionLocal()
    other_org, other_user = _make_org_and_user(db, f"other-{uuid.uuid4().hex[:8]}@test.com")
    other_org_id = other_org.id
    db.close()

    global active_test_user_id
    active_test_user_id = workspace["user_id"]
    client = TestClient(app)
    # Authenticated as workspace's user, but scoping the request to a workspace
    # they're not a member of.
    headers = {"X-Workspace-Id": str(other_org_id)}

    resp = client.patch(
        f"/api/recommendations/{workspace['trace_id']}/status",
        headers=headers,
        json={"status": "Completed"},
    )
    assert resp.status_code in (403, 404)
