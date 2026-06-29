# ==============================================================================
# PURPOSE: Integration tests for EVE Email Management System.
# DATA FLOW: Simulates email change requests, asserts verification claims logic,
#            asserts previous email warning logging, and checks audit log output.
# ==============================================================================

import uuid
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.models.audit_log import AuditLog
from app.core.security import get_current_user, verify_supabase_token

# 1. Setup isolated memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# Active test user profile context populated dynamically during tests
active_test_user_id = None
active_test_payload = {}

def mock_get_current_user(db: Session = Depends(get_db)):
    global active_test_user_id
    return db.query(Profile).filter(Profile.id == active_test_user_id).first()


def mock_verify_supabase_token():
    global active_test_payload
    return active_test_payload


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_email_overrides():
    """
    Ensures dependency overrides are clean and isolated specifically for this module.
    """
    old_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[verify_supabase_token] = mock_verify_supabase_token
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)


@pytest.fixture(scope="module")
def setup_email_data():
    """
    Seeds a test organization and manager user.
    """
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    # Create Tenant Organization
    org = Organization(id=org_id, name="Email Corp", slug="email-sec")
    db.add(org)
    
    # Create Profile
    profile = Profile(
        id=user_id,
        email="old_email@test.com",
        full_name="Email User",
        hashed_password="pw"
    )
    db.add(profile)
    
    # Link role membership
    mem = Membership(id=uuid.uuid4(), organization_id=org_id, user_id=user_id, role="manager")
    db.add(mem)
    
    db.commit()
    db.close()
    
    return {
        "org_id": org_id,
        "user_id": user_id
    }


def test_get_profile_with_verification_status(setup_email_data):
    """
    Verifies that the GET /me endpoint properly returns email_verified based on JWT claims.
    """
    global active_test_user_id, active_test_payload
    active_test_user_id = setup_email_data["user_id"]
    org_id = setup_email_data["org_id"]

    # 1. Test verified state
    active_test_payload = {
        "sub": str(active_test_user_id),
        "email": "old_email@test.com",
        "email_verified": True
    }

    client = TestClient(app)
    headers = {"X-Workspace-Id": str(org_id), "Authorization": "Bearer fake-token"}
    
    resp = client.get("/api/profile/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email_verified"] is True

    # 2. Test unverified state
    active_test_payload = {
        "sub": str(active_test_user_id),
        "email": "old_email@test.com",
        "email_verified": False,
        "email_confirmed_at": None
    }
    
    resp2 = client.get("/api/profile/me", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["email_verified"] is False


def test_email_change_request_trigger_and_logging(setup_email_data, caplog):
    """
    Tests requesting an email update, asserting warning logging and audit records.
    """
    global active_test_user_id, active_test_payload
    db = TestingSessionLocal()
    active_test_user_id = setup_email_data["user_id"]
    org_id = setup_email_data["org_id"]

    active_test_payload = {
        "sub": str(active_test_user_id),
        "email": "old_email@test.com"
    }

    client = TestClient(app)
    headers = {"X-Workspace-Id": str(org_id), "Authorization": "Bearer fake-token"}

    from unittest.mock import patch, MagicMock, AsyncMock
    from app.config import settings

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = '{"email": "new_email@test.com"}'

    with patch("httpx.AsyncClient.put", new_callable=AsyncMock) as mock_put:
        mock_put.return_value = mock_resp

        caplog.clear()
        payload = {"new_email": "new_email@test.com"}
        resp = client.post("/api/profile/me/email", json=payload, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

        # Check security notification logging
        warnings = [r.message for r in caplog.records if r.levelname == "WARNING"]
        assert any("SECURITY WARNING" in w for w in warnings)
        assert any("new_email@test.com" in w for w in warnings)

        # Check audit log persistence
        audit = db.query(AuditLog).filter(
            AuditLog.event_type == "email_change_requested",
            AuditLog.user_id == active_test_user_id
        ).first()
        assert audit is not None
        assert audit.before_state["email"] == "old_email@test.com"
        assert audit.after_state["pending_email"] == "new_email@test.com"

    db.close()
