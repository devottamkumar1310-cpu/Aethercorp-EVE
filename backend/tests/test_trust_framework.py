import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.schemas.executive import ExecutiveSynthesisResult, StrategicPriority
from app.services.ai.executive_formatter import ExecutiveFormatter

# Database Setup
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

client = TestClient(app)

def test_daily_brief_blocked_on_insufficient_data():
    db_session = TestingSessionLocal()
    # 1. Create a workspace with zero data
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    profile = Profile(id=user_id, email="insufficient@test.com", hashed_password="pw")
    org = Organization(id=org_id, name="Empty Workspace", slug="empty-workspace")
    membership = Membership(id=uuid.uuid4(), user_id=user_id, organization_id=org_id, role="owner")
    
    db_session.add_all([profile, org, membership])
    db_session.commit()
    db_session.close()

    # Override dependencies
    app.dependency_overrides[get_db] = override_get_db
    from app.core.security import get_current_user, get_required_workspace_id
    
    def mock_get_user():
        db = TestingSessionLocal()
        u = db.query(Profile).filter(Profile.id == user_id).first()
        db.expunge(u)
        db.close()
        return u

    app.dependency_overrides[get_current_user] = mock_get_user
    app.dependency_overrides[get_required_workspace_id] = lambda: org_id

    response = client.get("/api/executive/daily-brief")
    assert response.status_code == 200
    data = response.json()
    # Confirm it returned the explicit data sufficiency insufficiency message
    assert "Insufficient" in data["summary"]
    # Confirm no AI generation recommendations/risks are outputted
    assert len(data["risks"]) == 0
    assert len(data["opportunities"]) == 0

    # Clean up overrides
    app.dependency_overrides.clear()

def test_formatting_contains_all_trust_framework_elements():
    # Build a mockup synthesis result
    synthesis = ExecutiveSynthesisResult(
        agent="EVE COO",
        summary="Interpretation of cash flow.",
        priorities=[StrategicPriority(title="Action Item", description="Do this")],
        expected_impact="High growth",
        evidence_used={
            "metrics": {
                "revenue": 10000.0,
                "expenses": 4000.0,
                "profit": 6000.0,
                "clients": 3,
                "projects": 2,
                "tasks": 5,
                "inventory_count": 12
            }
        },
        confidence_scores={"Overall": 0.95},
        confidence_category="High Confidence"
    )

    formatted = ExecutiveFormatter.format_executive_response(synthesis, "Analyze financial growth and project status.", db=None, org_id=None)
    
    # 1. Verify separated sections exist
    assert "### 📋 Verified Facts (Database Ground Truth)" in formatted
    assert "### 🧠 EVE Executive Interpretation" in formatted
    assert "### 💡 Strategic Recommendations" in formatted
    assert "### 🔒 Auditable Trust Metrics" in formatted
    
    # 2. Verify evidence & source tables are printed
    assert "Total Revenue: $10,000.00" in formatted
    assert "Net Profit: $6,000.00" in formatted
    assert "Source Database Tables" in formatted
    assert "Recommendation Confidence" in formatted

def test_founder_mode_retains_trust_metrics():
    db_session = TestingSessionLocal()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    profile = Profile(id=user_id, email="founder@test.com", hashed_password="pw")
    org = Organization(id=org_id, name="Founder Workspace", slug="founder-workspace")
    membership = Membership(id=uuid.uuid4(), user_id=user_id, organization_id=org_id, role="owner")
    
    db_session.add_all([profile, org, membership])
    db_session.commit()
    db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    from app.core.security import get_current_user, get_required_workspace_id
    
    def mock_get_user():
        db = TestingSessionLocal()
        u = db.query(Profile).filter(Profile.id == user_id).first()
        db.expunge(u)
        db.close()
        return u

    app.dependency_overrides[get_current_user] = mock_get_user
    app.dependency_overrides[get_required_workspace_id] = lambda: org_id

    # Mock the board run to return a synthesis with trust metrics
    from unittest.mock import AsyncMock, patch
    mock_synthesis = ExecutiveSynthesisResult(
        agent="EVE COO",
        summary="Interpretation",
        priorities=[],
        expected_impact="Stable",
        confidence_scores={"Overall": 0.90},
        confidence_category="High Confidence",
        findings_by_agent={"Agent": ["Finding"]},
        governance_decisions={"data_sufficiency": "FULL_DATA"}
    )
    
    from app.services.ai.executive_board import ExecutiveBoard
    with patch.object(ExecutiveBoard, "run_board", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = mock_synthesis
        
        # Test request with developer_mode=False (simulating founder view)
        response = client.post("/api/executive/chat", json={
            "question": "What is our status?",
            "developer_mode": False
        })
        assert response.status_code == 200
        msg_data = response.json()["message"]
        
        # Verify that trust metrics are NOT stripped
        assert "confidence_scores" in msg_data["agent_data"]
        assert "findings_by_agent" in msg_data["agent_data"]
        assert "governance_decisions" in msg_data["agent_data"]

    app.dependency_overrides.clear()
