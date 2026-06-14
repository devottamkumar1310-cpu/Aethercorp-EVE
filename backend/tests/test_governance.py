import pytest
import uuid
import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.core.security import get_current_user_and_tenant, get_current_user, get_required_workspace_id
from app.core.dependency_container import container
from app.services.gemini_service import GeminiService
from app.orchestration.validator import ExecutiveGovernanceValidator
from app.services.error_monitoring_service import ErrorMonitoringService
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.models.system_error import SystemError

# Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

MOCK_USER_ID = uuid.uuid4()
MOCK_ORG_ID = uuid.uuid4()

db = TestingSessionLocal()
mock_org = Organization(id=MOCK_ORG_ID, name="Governance Test Org", slug="gov-test-org")
mock_user = Profile(id=MOCK_USER_ID, email="gov@example.com", full_name="Gov Officer", hashed_password="pw")
mock_membership = Membership(user_id=MOCK_USER_ID, organization_id=MOCK_ORG_ID, role="admin")
db.add(mock_org)
db.add(mock_user)
db.add(mock_membership)
db.commit()
db.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user_and_tenant():
    return {"user_id": MOCK_USER_ID, "organization_id": MOCK_ORG_ID}


def override_get_current_user():
    db = TestingSessionLocal()
    user = db.query(Profile).filter(Profile.id == MOCK_USER_ID).first()
    db.close()
    return user


def override_get_required_workspace_id():
    return MOCK_ORG_ID


client = TestClient(app)

def seed_business_data(db, org_id):
    from app.models.client import Client
    from app.models.project import Project
    from app.models.task import Task
    from app.models.product import Product
    from app.models.inventory import InventoryItem
    from app.models.finance import Revenue
    import datetime

    # Check if they already exist
    if db.query(Client).filter(Client.organization_id == org_id).count() == 0:
        client = Client(organization_id=org_id, company_name="Test Client", email="client@test.com", status="active")
        db.add(client)
        db.flush()
    else:
        client = db.query(Client).filter(Client.organization_id == org_id).first()

    if db.query(Product).filter(Product.organization_id == org_id).count() == 0:
        product = Product(organization_id=org_id, sku="SKU-SEED", name="Seeded Product", category="General", selling_price=100.0, unit_cost=40.0)
        db.add(product)
        db.flush()
        if db.query(InventoryItem).filter(InventoryItem.organization_id == org_id).count() == 0:
            item = InventoryItem(organization_id=org_id, product_id=product.id, stock_on_hand=50, reorder_point=10)
            db.add(item)

    if db.query(Project).filter(Project.organization_id == org_id).count() == 0:
        project = Project(organization_id=org_id, name="Test Project", client_id=client.id, status="active")
        db.add(project)
        db.flush()
    else:
        project = db.query(Project).filter(Project.organization_id == org_id).first()
        
    if db.query(Task).filter(Task.organization_id == org_id).count() == 0:
        task = Task(organization_id=org_id, title="Test Task", project_id=project.id, status="completed")
        db.add(task)
    if db.query(Revenue).filter(Revenue.organization_id == org_id).count() == 0:
        rev = Revenue(organization_id=org_id, project_id=project.id, amount=1000.0, date=datetime.datetime.utcnow(), description="Sales")
        db.add(rev)
    db.commit()

@pytest.fixture(autouse=True)
def setup_dependencies():
    service = container.get_optional("gemini_service")
    if not service:
        service = GeminiService()
        container.register_singleton("gemini_service", service)
    service.mock_mode = True

    # Seed dynamic business data
    db = TestingSessionLocal()
    seed_business_data(db, MOCK_ORG_ID)
    db.close()

    # Set dependency overrides dynamically for this module
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_and_tenant] = override_get_current_user_and_tenant
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_required_workspace_id] = override_get_required_workspace_id

    yield


def test_data_sufficiency_validator():
    """
    Test the data sufficiency checks in ExecutiveGovernanceValidator.
    """
    # 1. No Data
    overview = {}
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview)
    assert status == "NO_DATA"
    assert msg == "Insufficient business data available."

    # 2. Partial Data (only clients)
    overview = {"clients": 5, "projects": 0, "tasks": 0, "revenue": 0.0, "inventory": 0}
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview)
    assert status == "PARTIAL_DATA"
    assert domains["client"] is True
    assert domains["finance"] is False

    # 3. Query specific sufficiency (Question asks for finance, but no finance data)
    question = "Analyze our revenues and margins"
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview, question)
    assert status == "DATA_INSUFFICIENT"
    assert msg == "Insufficient financial data available."

    # 4. Customer query specific sufficiency
    overview_no_clients = {"clients": 0, "projects": 0, "tasks": 0, "revenue": 0.0, "inventory": 5}
    question_churn = "What is my customer churn risk?"
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview_no_clients, question_churn)
    assert status == "DATA_INSUFFICIENT"
    assert msg == "Insufficient customer data available."

    # 5. Inventory query specific sufficiency
    question_stock = "Analyze warehouse safety stock for SKU-102"
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview, question_stock)
    assert status == "DATA_INSUFFICIENT"
    assert msg == "Insufficient inventory data available."

    # 6. Operations query specific sufficiency
    question_ops = "Analyze operations capacity and delay bottlenecks"
    status, msg, domains = ExecutiveGovernanceValidator.validate_data_sufficiency(overview, question_ops)
    assert status == "DATA_INSUFFICIENT"
    assert msg == "Insufficient project data available."


def test_hallucination_and_risk_confidence_alignment():
    """
    Tests numerical/percentage claims verification and risk-evidence checks.
    """
    overview = {"revenue": 50000.0, "expenses": 10000.0, "profit": 40000.0, "clients": 15, "projects": 2, "tasks": 10, "inventory": 300}
    trends = {"revenue_trend": "upward"}
    
    class MockSynthesis:
        def __init__(self, summary, expected_impact, priorities):
            self.summary = summary
            self.expected_impact = expected_impact
            self.priorities = priorities

    class MockPriority:
        def __init__(self, title, description):
            self.title = title
            self.description = description

    # Case A: Correct claims
    synth_ok = MockSynthesis(
        summary="Net profit reached $40,000 this month. Revenue is growing.",
        expected_impact="Growth looks stable.",
        priorities=[MockPriority("Optimization", "Check reorder point safety stock.")]
    )
    is_valid, violations = ExecutiveGovernanceValidator.detect_hallucinations(synth_ok, overview, trends)
    assert is_valid is True
    assert len(violations) == 0

    # Case B: Unsupported numeric claim
    synth_fake_num = MockSynthesis(
        summary="Net profit reached $99,000 this month.",
        expected_impact="High Growth.",
        priorities=[]
    )
    is_valid, violations = ExecutiveGovernanceValidator.detect_hallucinations(synth_fake_num, overview, trends)
    assert is_valid is False
    assert any("Numerical claim $99,000" in v for v in violations)

    # Case C: Mismatched trend claim
    synth_fake_trend = MockSynthesis(
        summary="Calculated revenue is declining rapidly.",
        expected_impact="Revenue is decreasing.",
        priorities=[]
    )
    is_valid, violations = ExecutiveGovernanceValidator.detect_hallucinations(synth_fake_trend, overview, trends)
    assert is_valid is False
    assert any("calculated trend is upward" in v for v in violations)

    # Case D: Unsupported percentage claim
    synth_fake_pct = MockSynthesis(
        summary="Margins grew by 87% this week.",
        expected_impact="High margins.",
        priorities=[]
    )
    is_valid, violations = ExecutiveGovernanceValidator.detect_hallucinations(synth_fake_pct, overview, trends)
    assert is_valid is False
    assert any("Percentage claim 87.0%" in v for v in violations)

    # Case E: Risk-Confidence Alignment validation
    # Strategic Risk with High Confidence (85%) -> Not enough (requires >=90%)
    ok, err = ExecutiveGovernanceValidator.validate_risk_confidence_alignment(0.85, "Strategic Risk")
    assert ok is False
    assert "requires at least Executive Grade (90%)" in err

    # Strategic Risk with Executive Grade (92%) -> Valid
    ok, err = ExecutiveGovernanceValidator.validate_risk_confidence_alignment(0.92, "Strategic Risk")
    assert ok is True

    # High Risk with High Confidence (86%) -> Valid
    ok, err = ExecutiveGovernanceValidator.validate_risk_confidence_alignment(0.86, "High Risk")
    assert ok is True



def test_system_error_monitoring():
    """
    Test logging and retrieving errors via service and endpoints.
    """
    db_session = TestingSessionLocal()
    try:
        # Clear existing error logs
        db_session.query(SystemError).delete()
        db_session.commit()

        # Log through service
        error_log = ErrorMonitoringService.log_error(
            db=db_session,
            component="backend",
            error_type="DATABASE_ERROR",
            message="Lost connection to primary replica",
            org_id=MOCK_ORG_ID
        )
        assert error_log is not None
        assert error_log.error_type == "DATABASE_ERROR"

        # Query through service
        errors = ErrorMonitoringService.get_errors(db_session, org_id=MOCK_ORG_ID)
        assert len(errors) == 1
        assert errors[0].message == "Lost connection to primary replica"

        # Query through GET endpoint
        response = client.get("/api/observability/errors")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["error_type"] == "DATABASE_ERROR"

        # Log through POST endpoint
        error_payload = {
            "error_type": "JavascriptException",
            "message": "Uncaught TypeError: Cannot read properties of undefined (reading 'map')",
            "stack_trace": "TypeError: Cannot read properties of undefined\n    at ChatPanel (page.tsx:42:15)",
            "metadata": {"browser": "Chrome", "path": "/dashboard/eve"}
        }
        response = client.post("/api/observability/errors", json=error_payload)
        assert response.status_code == 200
        assert response.json()["status"] == "logged"

        # Verify both logs are now retrievable
        response = client.get("/api/observability/errors")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["error_type"] == "JavascriptException"
        assert data[1]["error_type"] == "DATABASE_ERROR"

    finally:
        db_session.close()


def test_daily_cost_budget_safeguard():
    """
    Test that the CostGovernanceService tracks costs, and the orchestrator
    blocks execution with a 422/402 Payment Required once the daily budget limit is exceeded.
    """
    db_session = TestingSessionLocal()
    try:
        # Create a new conversation and seed messages with cost telemetry
        conversation = ExecutiveConversation(
            organization_id=MOCK_ORG_ID,
            title="Cost Safeguard Test"
        )
        db_session.add(conversation)
        db_session.flush()

        # Seed 3 assistant messages with $0.75 cost each (total = $2.25, which exceeds default $2.00 limit)
        for i in range(3):
            msg = ExecutiveMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=f"Sub-agent recommendation {i}",
                agent_data={
                    "telemetry": {
                        "estimated_cost": 0.75,
                        "prompt_tokens": 1000,
                        "completion_tokens": 500,
                        "latency_ms": 1500,
                        "agents": {}
                    }
                }
            )
            db_session.add(msg)
        db_session.commit()

        # Send a chat request
        # The agent_orchestrator should check the CostGovernanceService, detect spent is $2.25 >= $2.00 budget,
        # and throw a 402 HTTP exception.
        payload = {
            "question": "What is our current burn rate?",
            "mode": "smart",
            "conversation_id": str(conversation.id)
        }
        response = client.post("/api/executive/chat", json=payload)
        assert response.status_code == 402
        assert "safeguard" in response.json()["detail"].lower()

    finally:
        db_session.close()


def test_observability_costs_endpoint():
    """
    Verify the costs breakdown endpoint aggregates daily, weekly, monthly and per-agent metrics correctly.
    """
    response = client.get("/api/observability/costs")
    assert response.status_code == 200
    data = response.json()
    assert "daily_cost" in data
    assert "weekly_cost" in data
    assert "monthly_cost" in data
    assert "agent_breakdown" in data
    assert data["daily_cost"] > 2.0  # Since we seeded $2.25 in test_daily_cost_budget_safeguard
