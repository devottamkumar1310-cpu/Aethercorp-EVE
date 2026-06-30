# ==============================================================================
# PURPOSE: Integration tests for EVE Google OAuth Authentication.
# DATA FLOW: Decodes mock token payloads representing Google authentication providers,
#            asserts email verification properties, and validates profile matching.
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
from app.models.profile import Profile
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

# Active mock token payload returned dynamically by verify_supabase_token override
active_oauth_payload = {}

def override_verify_supabase_token():
    global active_oauth_payload
    return active_oauth_payload


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_oauth_overrides():
    """
    Ensures dependency overrides are clean and isolated specifically for this module.
    """
    old_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_supabase_token] = override_verify_supabase_token
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)


def test_google_oauth_auto_verification():
    """
    Verifies that Google provider tokens assert email_verified as True natively.
    """
    global active_oauth_payload
    db = TestingSessionLocal()
    
    # Register mock profile beforehand
    google_user_uuid = uuid.uuid4()
    profile = Profile(
        id=google_user_uuid,
        email="google_user@test.com",
        full_name="Google User",
        hashed_password="pw"
    )
    db.add(profile)
    db.commit()
    db.close()

    # Simulate token payload sent by Supabase Google Provider
    active_oauth_payload = {
        "sub": str(google_user_uuid),
        "email": "google_user@test.com",
        "email_verified": True,
        "app_metadata": {"provider": "google"}
    }

    client = TestClient(app)
    headers = {"Authorization": "Bearer fake-google-token"}

    resp = client.get("/api/profile/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "google_user@test.com"
    assert data["email_verified"] is True


def test_existing_account_linking():
    """
    Asserts account migration sync when an email already exists in EVE profile.
    If the user has an existing account and logs in via Google OAuth, the system
    matches and retrieves the matching email profile seamlessly.
    """
    global active_oauth_payload
    db = TestingSessionLocal()

    # Existing profile ID
    existing_user_uuid = uuid.uuid4()
    profile = Profile(
        id=existing_user_uuid,
        email="common_email@test.com",
        full_name="Legacy User",
        hashed_password="pw"
    )
    db.add(profile)
    db.commit()
    db.close()

    # Google OAuth signs in with a different UUID (sub claim) but matching email address
    new_google_sub = uuid.uuid4()
    active_oauth_payload = {
        "sub": str(new_google_sub),
        "email": "common_email@test.com",
        "email_verified": True,
        "app_metadata": {"provider": "google"}
    }

    client = TestClient(app)
    headers = {"Authorization": "Bearer fake-google-token"}

    # Trigger sync/account linking first
    sync_resp = client.post("/api/auth/sync", headers=headers)
    assert sync_resp.status_code == 200

    # Resolves user via get_current_user dependency triggering auto-sync linking checks
    resp = client.get("/api/profile/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    
    # Matches email successfully
    assert data["email"] == "common_email@test.com"
