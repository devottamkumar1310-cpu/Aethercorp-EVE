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
from app.core.security import get_current_user_and_tenant, get_current_user, get_required_workspace_id
from app.core.dependency_container import container
from app.services.gemini_service import GeminiService

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
    # Ensure gemini_service is registered in container since other tests might clear it
    service = container.get_optional("gemini_service")
    if not service:
        service = GeminiService()
        container.register_singleton("gemini_service", service)
    # Force mock mode to avoid hitting live Gemini API rate limits in tests
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

# Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Seed basic entities

Base.metadata.create_all(bind=engine)

MOCK_USER_ID = uuid.uuid4()
MOCK_ORG_ID = uuid.uuid4()

db = TestingSessionLocal()
mock_org = Organization(id=MOCK_ORG_ID, name="Executive Test Org", slug="exec-test-org")
mock_user = Profile(id=MOCK_USER_ID, email="ceo@example.com", full_name="CEO EVE", hashed_password="pw")
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


def test_goals_lifecycle():
    """
    Test creating, listing, and deleting Business Goals.
    """
    # 1. Create Goal
    payload = {
        "goal_type": "profitability",
        "description": "Increase net margins by 15% before Q4",
        "target_value": 15.0
    }
    response = client.post("/api/executive/goals", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["goal_type"] == "profitability"
    assert "id" in data
    goal_id = data["id"]

    # 2. List Goals
    response = client.get("/api/executive/goals")
    assert response.status_code == 200
    goals = response.json()
    assert len(goals) == 1
    assert goals[0]["id"] == goal_id

    # 3. Delete Goal
    response = client.delete(f"/api/executive/goals/{goal_id}")
    assert response.status_code == 200

    # 4. List Goals Empty
    response = client.get("/api/executive/goals")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_daily_brief():
    """
    Test compilation and formatting of daily brief summaries.
    """
    response = client.get("/api/executive/daily-brief")
    assert response.status_code == 200
    brief = response.json()
    assert "health_score" in brief
    assert "health_status" in brief
    assert "summary" in brief
    assert "risks" in brief


def test_executive_chat():
    """
    Test interactive executive chat with smart mock mode routing.
    """
    payload = {
        "question": "How is my business doing and what needs attention?",
        "mode": "smart",
        "conversation_id": None
    }
    response = client.post("/api/executive/chat", json=payload)
    assert response.status_code == 200
    chat_res = response.json()
    assert "response" in chat_res or "message" in chat_res
    assert "conversation_id" in chat_res


def test_executive_chat_fallback_on_429():
    """
    Test that when Gemini service raises a 429 RESOURCE_EXHAUSTED error,
    the orchestrator falls back to the deterministic mode and completes successfully.
    """
    gemini_service = container.get("gemini_service")
    
    original_generate_structured = gemini_service.generate_structured_response
    original_mock_mode = gemini_service.mock_mode
    
    try:
        # Mock structured response to raise a 429
        async def mock_raise_429(*args, **kwargs):
            raise Exception("429 RESOURCE_EXHAUSTED: Quota exceeded")
        
        gemini_service.generate_structured_response = mock_raise_429
        gemini_service.mock_mode = False # Force it to call the mocked method and hit the exception block
        
        payload = {
            "question": "How is my business doing?",
            "mode": "smart",
            "conversation_id": None
        }
        response = client.post("/api/executive/chat", json=payload)
        
        # Should complete successfully (status code 200) because of deterministic fallback
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "fallback" in data["message"]["content"].lower()
        
    finally:
        # Restore
        gemini_service.generate_structured_response = original_generate_structured
        gemini_service.mock_mode = original_mock_mode


def test_daily_brief_fallback_on_503():
    """
    Test daily brief fallback behavior when LLM is unavailable.
    """
    gemini_service = container.get("gemini_service")
    
    original_generate_structured = gemini_service.generate_structured_response
    original_mock_mode = gemini_service.mock_mode
    
    try:
        async def mock_raise_503(*args, **kwargs):
            raise Exception("503 SERVICE_UNAVAILABLE: Gemini Failure")
            
        gemini_service.generate_structured_response = mock_raise_503
        gemini_service.mock_mode = False
        
        response = client.get("/api/executive/daily-brief")
        
        # Should complete successfully (status code 200) because of daily brief deterministic fallback
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "fallback" in data["summary"].lower()
        
    finally:
        gemini_service.generate_structured_response = original_generate_structured
        gemini_service.mock_mode = original_mock_mode


def test_executive_chat_fallback_intent_routing():
    """
    Verify that fallback mode performs intent classification on user questions
    and queries relevant intelligence services to generate distinct, context-specific responses.
    """
    gemini_service = container.get("gemini_service")
    
    original_generate_structured = gemini_service.generate_structured_response
    original_mock_mode = gemini_service.mock_mode
    
    try:
        # Mock Gemini service to raise a 429 error, forcing fallback mode
        async def mock_raise_429(*args, **kwargs):
            raise Exception("429 RESOURCE_EXHAUSTED: Gemini Busy")
        
        gemini_service.generate_structured_response = mock_raise_429
        gemini_service.mock_mode = False
        
        # Test 1: Finance Intent
        res_finance = client.post("/api/executive/chat", json={
            "question": "What is our current finance summary?",
            "mode": "smart"
        })
        assert res_finance.status_code == 200
        data_finance = res_finance.json()
        assert "financ" in data_finance["message"]["content"].lower()
        
        # Test 2: Inventory Intent
        res_inventory = client.post("/api/executive/chat", json={
            "question": "Identify overstock risks in inventory",
            "mode": "smart"
        })
        assert res_inventory.status_code == 200
        data_inventory = res_inventory.json()
        assert "inventory" in data_inventory["message"]["content"].lower()
        
        # Test 3: Growth/Opportunities Intent
        res_growth = client.post("/api/executive/chat", json={
            "question": "Are there any growth opportunities?",
            "mode": "smart"
        })
        assert res_growth.status_code == 200
        data_growth = res_growth.json()
        assert "growth" in data_growth["message"]["content"].lower()
        
        # Test 4: Client/Customer Intent
        res_client = client.post("/api/executive/chat", json={
            "question": "Which clients are at risk?",
            "mode": "smart"
        })
        assert res_client.status_code == 200
        data_client = res_client.json()
        assert "client" in data_client["message"]["content"].lower()
        
        # Test 5: Default/Attention Intent
        res_attention = client.post("/api/executive/chat", json={
            "question": "What needs my attention?",
            "mode": "smart"
        })
        assert res_attention.status_code == 200
        data_attention = res_attention.json()
        assert "attention" in data_attention["message"]["content"].lower()
        
        # Verify that all 5 generated different fallback contents
        contents = [
            data_finance["message"]["content"],
            data_inventory["message"]["content"],
            data_growth["message"]["content"],
            data_client["message"]["content"],
            data_attention["message"]["content"]
        ]
        
        # Ensure they are all unique
        assert len(set(contents)) == 5
        
    finally:
        gemini_service.generate_structured_response = original_generate_structured
        gemini_service.mock_mode = original_mock_mode


def test_conversations_chat_history_crud():
    client = TestClient(app)
    
    # 1. Send first message to start conversation and trigger auto-titling
    res = client.post("/api/executive/chat", json={
        "question": "What is our current financial health score?",
        "mode": "smart"
    })
    assert res.status_code == 200
    data = res.json()
    conv_id = data["conversation_id"]
    title = data["title"]
    
    # Verify lightweight title: "What is our current financial health score?"
    # First 5 words capitalized, punctuation stripped, and "..." appended since word count > 5
    assert title == "What Is Our Current Financial..."
    
    # 2. Get list of conversations
    res_list = client.get("/api/executive/conversations")
    assert res_list.status_code == 200
    conversations = res_list.json()
    assert len(conversations) > 0
    target_conv = next(c for c in conversations if str(c["id"]) == conv_id)
    assert target_conv["message_count"] == 2
    assert "updated_at" in target_conv
    
    # 3. Get detailed messages of this conversation
    res_detail = client.get(f"/api/executive/conversations/{conv_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["title"] == "What Is Our Current Financial..."
    assert len(detail["messages"]) == 2  # User message and Assistant response
    assert detail["messages"][0]["role"] == "user"
    assert detail["messages"][1]["role"] == "assistant"
    
    # 4. Rename the conversation
    res_rename = client.patch(f"/api/executive/conversations/{conv_id}", json={
        "title": "Renamed Budget Review"
    })
    assert res_rename.status_code == 200
    assert res_rename.json()["title"] == "Renamed Budget Review"
    
    # Verify name updated in detail API
    res_detail_updated = client.get(f"/api/executive/conversations/{conv_id}")
    assert res_detail_updated.json()["title"] == "Renamed Budget Review"
    
    # 5. Delete the conversation
    res_delete = client.delete(f"/api/executive/conversations/{conv_id}")
    assert res_delete.status_code == 200
    assert res_delete.json()["status"] == "success"
    
    # Verify it returns 404 now
    res_detail_404 = client.get(f"/api/executive/conversations/{conv_id}")
    assert res_detail_404.status_code == 404



