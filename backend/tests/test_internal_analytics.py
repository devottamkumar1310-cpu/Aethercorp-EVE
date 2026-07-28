import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.main import app
from app.database import Base, get_db
from app.models.profile import Profile
from app.core.security import get_current_user

# Test DB Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_internal_analytics_forbidden_for_non_admin():
    """
    Verifies that a non-admin account requesting /api/internal/overview receives HTTP 403 Forbidden.
    """
    non_admin = Profile(
        id=uuid.uuid4(),
        email="regular_user_test@example.com",
        hashed_password="hashed_test_pass",
        full_name="Regular User",
        plan_type="starter"
    )

    app.dependency_overrides[get_current_user] = lambda: non_admin

    response = client.get("/api/internal/overview")
    assert response.status_code == 403
    json_data = response.json()
    assert "Access denied" in (json_data.get("message") or json_data.get("detail") or "")


def test_internal_analytics_allowed_for_owner_email():
    """
    Verifies that the owner admin email receives HTTP 200 OK and valid telemetry JSON.
    """
    owner = Profile(
        id=uuid.uuid4(),
        email="devottamkumar1310@gmail.com",
        hashed_password="hashed_test_pass",
        full_name="Owner Admin",
        plan_type="enterprise"
    )

    app.dependency_overrides[get_current_user] = lambda: owner

    response = client.get("/api/internal/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_organizations" in data
    assert "demo_workspaces" in data
