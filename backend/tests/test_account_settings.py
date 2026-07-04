# ==============================================================================
# PURPOSE: Integration tests for EVE Account Settings Enhancement.
# DATA FLOW: Updates profile options, validates image type/size constraints,
#            asserts database state changes, and checks audit log entries.
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
from app.core.security import get_current_user

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
def setup_settings_overrides():
    """
    Ensures dependency overrides are clean and isolated specifically for this module.
    """
    old_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)


@pytest.fixture(scope="module")
def setup_settings_data():
    """
    Seeds a test organization and manager user.
    """
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    # Create Tenant Organization
    org = Organization(id=org_id, name="Settings Corp", slug="set-sec")
    db.add(org)
    
    # Create Profile
    profile = Profile(
        id=user_id,
        email="settings_user@test.com",
        full_name="Settings User",
        hashed_password="pw",
        timezone="UTC",
        language="en"
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


def test_update_profile_endpoint(setup_settings_data):
    """
    Tests updating timezone, language, and full_name with audit trails.
    """
    global active_test_user_id
    db = TestingSessionLocal()
    org_id = setup_settings_data["org_id"]
    active_test_user_id = setup_settings_data["user_id"]

    try:
        client = TestClient(app)
        headers = {"X-Workspace-Id": str(org_id)}
        
        # Trigger update
        payload = {
            "full_name": "Settings User Updated",
            "timezone": "America/New_York",
            "language": "es"
        }
        resp = client.put("/api/profile/me", json=payload, headers=headers)
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["full_name"] == "Settings User Updated"
        assert data["timezone"] == "America/New_York"
        assert data["language"] == "es"

        # Verify audit log exists
        audit = db.query(AuditLog).filter(
            AuditLog.event_type == "profile_update",
            AuditLog.user_id == active_test_user_id
        ).first()
        assert audit is not None
        assert audit.before_state["full_name"] == "Settings User"
        assert audit.after_state["timezone"] == "America/New_York"

    finally:
        db.close()


def test_avatar_upload_type_validation(setup_settings_data):
    """
    Tests uploading invalid image types (e.g. text/plain or executable scripts).
    """
    global active_test_user_id
    org_id = setup_settings_data["org_id"]
    active_test_user_id = setup_settings_data["user_id"]

    client = TestClient(app)
    headers = {"X-Workspace-Id": str(org_id)}

    # Send plain text file masquerading as script
    files = {"file": ("avatar.txt", b"dummy plain text", "text/plain")}
    resp = client.post("/api/profile/me/avatar", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Only JPG, JPEG, and PNG are allowed" in resp.json()["detail"]


def test_avatar_upload_size_validation(setup_settings_data):
    """
    Tests uploading files exceeding 2MB size limits.
    """
    global active_test_user_id
    org_id = setup_settings_data["org_id"]
    active_test_user_id = setup_settings_data["user_id"]

    client = TestClient(app)
    headers = {"X-Workspace-Id": str(org_id)}

    # Generate 3MB mock image buffer
    large_buffer = b"0" * (3 * 1024 * 1024)
    files = {"file": ("avatar.png", large_buffer, "image/png")}
    resp = client.post("/api/profile/me/avatar", files=files, headers=headers)
    assert resp.status_code == 400
    assert "File size exceeds maximum limit of 2MB" in resp.json()["detail"]


def test_avatar_upload_success(setup_settings_data):
    """
    Tests a successful PNG upload resulting in updated avatar_url and audit trails.
    """
    global active_test_user_id
    db = TestingSessionLocal()
    org_id = setup_settings_data["org_id"]
    active_test_user_id = setup_settings_data["user_id"]

    try:
        client = TestClient(app)
        headers = {"X-Workspace-Id": str(org_id)}

        files = {"file": ("avatar.png", b"fake-png-content-bytes", "image/png")}
        resp = client.post("/api/profile/me/avatar", files=files, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"
        assert "avatar_url" in resp.json()

        # Check audit log
        audit = db.query(AuditLog).filter(
            AuditLog.event_type == "avatar_update",
            AuditLog.user_id == active_test_user_id
        ).first()
        assert audit is not None
        assert "fake-png-content-bytes" not in str(audit.after_state)

    finally:
        db.close()
