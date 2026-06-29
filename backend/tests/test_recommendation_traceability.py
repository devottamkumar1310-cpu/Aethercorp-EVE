# ==============================================================================
# PURPOSE: Integration tests for Recommendation Traceability Phase 1 features.
# DATA FLOW: Seeding organizations, generating traces via RecommendationTraceService,
#            asserting database persistence, and testing API route scopes.
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
from app.services.recommendation_trace_service import RecommendationTraceService
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
def setup_traceability_overrides():
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
def setup_traceability_data():
    """
    Seeds a test organization and manager user.
    """
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    # Create Tenant Organization
    org = Organization(id=org_id, name="Traceability Corp", slug="trace-sec")
    db.add(org)
    
    # Create Profile
    profile = Profile(id=user_id, email="manager@trace.com", full_name="Trace Manager", hashed_password="pw")
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


def test_recommendation_trace_creation_and_api(setup_traceability_data):
    """
    Verifies that a created RecommendationTrace persists in the database
    and can be fetched via API routes.
    """
    global active_test_user_id
    db = TestingSessionLocal()
    org_id = setup_traceability_data["org_id"]
    active_test_user_id = setup_traceability_data["user_id"]

    try:
        # Create a trace via service
        trace = RecommendationTraceService.create_trace(
            db=db,
            org_id=org_id,
            rec_type="reorder",
            action="Order 200 units from supplier Beta",
            confidence=0.91,
            sources=["Inventory Item #456"],
            metrics={"stock": 5, "threshold": 20},
            reasoning=["Stock 5 fell below safety limit of 20."]
        )
        assert trace.id is not None
        assert trace.recommendation_type == "reorder"

        # Call API list
        client = TestClient(app)
        headers = {"X-Workspace-Id": str(org_id)}
        resp = client.get("/api/recommendations", headers=headers)
        assert resp.status_code == 200
        
        traces = resp.json()
        assert len(traces) > 0
        assert traces[0]["action"] == "Order 200 units from supplier Beta"
        assert traces[0]["confidence_score"] == 0.91

        # Call API detail
        detail_resp = client.get(f"/api/recommendations/{trace.id}", headers=headers)
        assert detail_resp.status_code == 200
        detail_data = detail_resp.json()
        assert detail_data["supporting_metrics"]["stock"] == 5

    finally:
        db.close()
