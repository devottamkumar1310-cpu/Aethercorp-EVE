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
from app.core.security import verify_supabase_token

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
    app.dependency_overrides[verify_supabase_token] = lambda: {
        "sub": "00000000-0000-0000-0000-000000000099",
        "email": "regular_user_test@example.com"
    }

    response = client.get("/api/internal/overview")
    assert response.status_code == 403
    json_data = response.json()
    assert "Access denied" in (json_data.get("message") or json_data.get("detail") or "")


def test_internal_analytics_allowed_for_owner_email():
    """
    Verifies that the owner admin email receives HTTP 200 OK and valid telemetry JSON.
    """
    app.dependency_overrides[verify_supabase_token] = lambda: {
        "sub": "00000000-0000-0000-0000-000000000001",
        "email": "devottamkumar1310@gmail.com"
    }

    response = client.get("/api/internal/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_organizations" in data
    assert "demo_workspaces" in data
