# ==============================================================================
# PURPOSE: Integration security tests for Tenant Isolation and Authentication.
# DATA FLOW: Sends mock HTTP requests -> asserts status codes and tenant boundary scoping.
# ==============================================================================

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.core.security import get_current_user

# 1. Setup in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ensure models register on Base
Base.metadata.create_all(bind=engine)

# Seed multiple organizations and users to verify tenant boundaries
USER_A_ID = uuid.uuid4()
USER_B_ID = uuid.uuid4()

ORG_A_ID = uuid.uuid4()
ORG_B_ID = uuid.uuid4()

db = TestingSessionLocal()

# Create Profiles
user_a = Profile(id=USER_A_ID, email="user_a@example.com", full_name="User A", hashed_password="pw")
user_b = Profile(id=USER_B_ID, email="user_b@example.com", full_name="User B", hashed_password="pw")
db.add(user_a)
db.add(user_b)

# Create Organizations
org_a = Organization(id=ORG_A_ID, name="Organization A", slug="org-a")
org_b = Organization(id=ORG_B_ID, name="Organization B", slug="org-b")
db.add(org_a)
db.add(org_b)

# Memberships: User A belongs ONLY to Org A; User B belongs ONLY to Org B
membership_a = Membership(user_id=USER_A_ID, organization_id=ORG_A_ID, role="admin")
membership_b = Membership(user_id=USER_B_ID, organization_id=ORG_B_ID, role="admin")
db.add(membership_a)
db.add(membership_b)

db.commit()
db.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# We will override current user dynamically during the test using dependency overrides
# or mock payloads. Let's use a context-driven override model.
active_test_user = None

def mock_get_current_user():
    global active_test_user
    if not active_test_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")
    return active_test_user


@pytest.fixture(autouse=True)
def setup_dependency_overrides():
    # Save original overrides
    old_overrides = dict(app.dependency_overrides)
    # Clear and set our overrides
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    # Restore original overrides
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)


client = TestClient(app)


def test_workspace_membership_enforcement():
    """
    Verifies that a user cannot access workspaces they do not belong to.
    """
    global active_test_user
    
    # Authenticate as User A
    db_session = TestingSessionLocal()
    active_test_user = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    db_session.close()

    # 1. Access Org A (should be allowed since User A is a member of Org A)
    headers = {"X-Workspace-Id": str(ORG_A_ID)}
    response = client.get("/api/analytics/overview", headers=headers)
    assert response.status_code == 200

    # 2. Try to access Org B (should be Forbidden / 403)
    headers_malicious = {"X-Workspace-Id": str(ORG_B_ID)}
    response = client.get("/api/analytics/overview", headers=headers_malicious)
    assert response.status_code == 403
    assert "Not a member of this workspace" in response.json()["detail"]


def test_chat_unauthenticated_request():
    """
    Verifies that unauthenticated requests to the Chat endpoint are rejected with 401.
    """
    global active_test_user
    active_test_user = None # Simulate no logged-in user

    response = client.post("/api/chat", json={"message": "Analyze inventory"})
    assert response.status_code == 401


def test_chat_authenticated_workspace_membership():
    """
    Verifies that an authenticated user can chat only when specifying their active workspace.
    """
    global active_test_user
    db_session = TestingSessionLocal()
    active_test_user = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    db_session.close()

    # 1. User A request with Org A (should succeed, though chat calls external services, we test up to auth routing)
    # We expect either a success response or a controlled 500 error inside the agents execution
    # but NOT a 401/403 security block.
    headers = {"X-Workspace-Id": str(ORG_A_ID)}
    response = client.post("/api/chat", json={"message": "Analyze inventory"}, headers=headers)
    assert response.status_code != 403
    assert response.status_code != 401

    # 2. User A request with Org B (should immediately raise 403 Forbidden before triggering agent logic)
    headers_malicious = {"X-Workspace-Id": str(ORG_B_ID)}
    response = client.post("/api/chat", json={"message": "Analyze inventory"}, headers=headers_malicious)
    assert response.status_code == 403
