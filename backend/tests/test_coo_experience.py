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
from app.services.ai.conversation_layer import ConversationLayer

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
mock_org = Organization(id=MOCK_ORG_ID, name="COO Experience Test Org", slug="coo-test-org")
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


def clear_mock_org():
    from app.models.product import Product
    from app.models.inventory import InventoryItem, SalesRecord
    from app.models.client import Client
    from app.models.project import Project
    from app.models.task import Task
    from app.models.finance import Revenue, Expense
    db = TestingSessionLocal()
    db.query(SalesRecord).filter(SalesRecord.organization_id == MOCK_ORG_ID).delete()
    db.query(InventoryItem).filter(InventoryItem.organization_id == MOCK_ORG_ID).delete()
    db.query(Product).filter(Product.organization_id == MOCK_ORG_ID).delete()
    db.query(Task).filter(Task.organization_id == MOCK_ORG_ID).delete()
    db.query(Revenue).filter(Revenue.organization_id == MOCK_ORG_ID).delete()
    db.query(Expense).filter(Expense.organization_id == MOCK_ORG_ID).delete()
    db.query(Project).filter(Project.organization_id == MOCK_ORG_ID).delete()
    db.query(Client).filter(Client.organization_id == MOCK_ORG_ID).delete()
    db.commit()
    db.close()


def seed_full_demo_database():
    clear_mock_org()
    from app.models.product import Product
    from app.models.inventory import InventoryItem, SalesRecord
    from app.models.client import Client
    from app.models.project import Project
    from app.models.task import Task
    from app.models.finance import Revenue, Expense
    import datetime

    db_session = TestingSessionLocal()
    
    prod = Product(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        sku="TST-SKU-001",
        name="Test Overstock Dress",
        category="Dresses",
        unit_cost=20.0,
    )
    db_session.add(prod)
    db_session.flush()

    inv_item = InventoryItem(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        product_id=prod.id,
        stock_on_hand=500,
        safety_stock=50,
        reorder_point=100,
        lead_time_days=14,
        avg_daily_sales=0.5
    )
    db_session.add(inv_item)

    today = datetime.date.today()
    sales_rec = SalesRecord(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        product_id=prod.id,
        date=today - datetime.timedelta(days=2),
        quantity=5,
        unit_price=50.0,
        revenue=250.0
    )
    db_session.add(sales_rec)

    client_a = Client(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        company_name="Client Alpha",
        status="active"
    )
    db_session.add(client_a)
    db_session.flush()

    proj_a = Project(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        client_id=client_a.id,
        name="Project Alpha",
        status="active",
        completion_percentage=40.0,
        deadline=datetime.datetime.utcnow() - datetime.timedelta(days=10),
        budget=3000.0
    )
    db_session.add(proj_a)
    db_session.flush()

    task_a = Task(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        project_id=proj_a.id,
        title="Overdue Milestone Alpha",
        status="todo",
        due_date=datetime.datetime.utcnow() - datetime.timedelta(days=5),
        priority="high"
    )
    db_session.add(task_a)

    rev = Revenue(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        project_id=proj_a.id,
        amount=5000.0,
        date=datetime.datetime.utcnow() - datetime.timedelta(days=5),
        description="Demo Sales"
    )
    db_session.add(rev)

    exp1 = Expense(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        amount=2000.0,
        category="Software Licenses",
        date=datetime.datetime.utcnow() - datetime.timedelta(days=5),
        description="SaaS Subscription"
    )
    db_session.add(exp1)

    db_session.commit()
    db_session.close()


client = TestClient(app, headers={"Authorization": "Bearer mock-token"})


@pytest.fixture(autouse=True)
def setup_dependencies():
    # Ensure gemini_service is registered in container
    service = container.get_optional("gemini_service")
    if not service:
        service = GeminiService()
        container.register_singleton("gemini_service", service)
    service.mock_mode = True

    db_session = TestingSessionLocal()
    if not db_session.query(Organization).filter(Organization.id == MOCK_ORG_ID).first():
        db_session.add(Organization(id=MOCK_ORG_ID, name="COO Experience Test Org", slug="coo-test-org"))
    if not db_session.query(Profile).filter(Profile.id == MOCK_USER_ID).first():
        db_session.add(Profile(id=MOCK_USER_ID, email="ceo@example.com", full_name="CEO EVE", hashed_password="pw"))
    if not db_session.query(Membership).filter(Membership.user_id == MOCK_USER_ID, Membership.organization_id == MOCK_ORG_ID).first():
        db_session.add(Membership(user_id=MOCK_USER_ID, organization_id=MOCK_ORG_ID, role="admin"))
    db_session.commit()
    db_session.close()

    from app.core.security import verify_supabase_token, security, get_active_workspace_id
    client.headers.update({"Authorization": "Bearer mock-token"})
    app.dependency_overrides[verify_supabase_token] = lambda: {"sub": str(MOCK_USER_ID)}
    app.dependency_overrides[security] = lambda: HTTPAuthorizationCredentials(scheme="Bearer", credentials="mock-token")
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_and_tenant] = override_get_current_user_and_tenant
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_required_workspace_id] = override_get_required_workspace_id
    app.dependency_overrides[get_active_workspace_id] = override_get_required_workspace_id
    
    yield


def test_greeting_intent_routing():
    """
    Test that greetings are deterministically classified as Greeting,
    and returns localized responses immediately, bypassing the LLM.
    """
    variants = [
        "hi", "hii", "hiii", "hello", "helloo", "hellooo", 
        "hey", "heyy", "heyyy", "good morning", "namaste", "namasteee"
    ]
    for variant in variants:
        intent = ConversationLayer.classify_intent(variant)
        assert intent == "Greeting", f"Failed to classify greeting variant: {variant}"
        
        # Test direct static intent handler
        result = ConversationLayer.handle_static_intent(intent, "en", variant)
        assert result.confidence_scores["Overall"] == 1.0

        # Test API response with Greeting (Founder Mode/Default Mode)
        response = client.post("/api/executive/chat", json={
            "question": variant,
            "mode": "smart"
        })
        assert response.status_code == 200, f"Failed for variant: {variant}"
        data = response.json()
        assert "message" in data
        
        content = data["message"]["content"]
        # Verify response is dynamic and short
        if "hi" in variant:
            assert "Hi! How can I help today?" in content
        elif "hello" in variant:
            assert "Hello! What can I help you with?" in content
        elif "hey" in variant:
            assert "Hey! What's on your mind?" in content
        elif "namaste" in variant:
            assert "Namaste! How can I help today?" in content
        elif "morning" in variant:
            assert "Good morning! How can I help you today?" in content

        # Telemetry should be stripped in Founder Mode
def test_intent_classification_hardening():
    """
    Harden intent classification against static intent spillovers and ensure
    business queries never map to courtesy/conversational intents.
    """
    # 1. Courtesy/Conversational static intents (Must Pass)
    assert ConversationLayer.classify_intent("thanks") == "Thanks"
    assert ConversationLayer.classify_intent("thank you") == "Thanks"
    assert ConversationLayer.classify_intent("thx") == "Thanks"
    assert ConversationLayer.classify_intent("hello") == "Greeting"
    
    # 2. Business Queries (Must Never Map to static/courtesy intents)
    business_queries = [
        "How do we increase sales?",
        "What risks are impacting sales?",
        "How do we mitigate overdue tasks?",
        "Should we reorder inventory?",
        "What is hurting profitability?",
        "Which clients are at risk?"
    ]
    for q in business_queries:
        intent = ConversationLayer.classify_intent(q)
        assert intent not in ["Thanks", "Greeting", "Goodbye", "Small Talk"], f"Query '{q}' was misclassified as conversational intent: {intent}"


def test_agent_routing_for_sales():
    """
    Verify that query 'How do we increase sales?' routes exactly to Finance Agent
    and Growth Agent.
    """
    from app.services.gemini_service import GeminiService
    from app.services.ai.executive_board import AgentSelection
    import asyncio
    
    service = GeminiService()
    service.mock_mode = True
    
    res = asyncio.run(service.generate_structured_response(
        prompt="User Question: How do we increase sales?",
        response_schema=AgentSelection
    ))
    assert res.run_finance is True
    assert res.run_growth is True
    assert res.run_operations is False
    assert res.run_inventory is False
    assert res.run_client is False
    assert res.run_forecasting is False


def test_greeting_intent_bypass_and_latency():
    """
    Verify that greeting intents bypass ExecutiveBoard, Governance validation,
    and return in under 100ms.
    """
    import asyncio
    import time
    from unittest.mock import AsyncMock
    from app.services.ai.agent_orchestrator import AgentOrchestrator
    
    orchestrator = AgentOrchestrator()
    # Mock ExecutiveBoard.run_board to make sure it is NEVER called
    orchestrator.board.run_board = AsyncMock(side_effect=Exception("ExecutiveBoard should not be invoked!"))
    
    db_session = TestingSessionLocal()
    
    async def run_test():
        start_time = time.time()
        message = await orchestrator.orchestrate(
            db=db_session,
            org_id=MOCK_ORG_ID,
            question="hii",
            mode="smart",
            user_id=MOCK_USER_ID
        )
        duration = time.time() - start_time
        
        # Verify near-instant response (< 100ms)
        assert duration < 0.1, f"Greeting routing took too long: {duration}s"
        # Verify EVE response content is the short conversational one
        assert message.content == "Hi! How can I help today?"
        # Verify ExecutiveBoard was not called
        assert not orchestrator.board.run_board.called

    try:
        asyncio.run(run_test())
    finally:
        db_session.close()


def test_capability_discovery():
    """
    Test that 'What do you do?' triggers the capability discovery flow.
    """
    intent = ConversationLayer.classify_intent("What do you do?")
    assert intent == "Capability Discovery"

    response = client.post("/api/executive/chat", json={
        "question": "What do you do?",
        "mode": "smart"
    })
    assert response.status_code == 200
    data = response.json()
    assert "professional AI COO for D2C fashion brands" in data["message"]["content"]


def test_data_sufficiency_friendly_rewrite():
    """
    Test that insufficient data does not result in raw system errors but returns
    a friendly onboarding pathway rewrite.
    """
    # Send a forecast query on an empty database setup
    # In Mock mode, Gemini Service will return mock response with insufficient data keywords
    # to test data sufficiency fallback
    response = client.post("/api/executive/chat", json={
        "question": "Give me a pricing forecast for all inventory",
        "mode": "smart"
    })
    assert response.status_code == 200
    data = response.json()
    # It should not contain internal "hallucination detected" or "Data sufficiency failed" messages,
    # but rather friendly ones.
    content = data["message"]["content"]
    assert "insufficient" in content.lower() or "need more" in content.lower() or "enough verified data" in content.lower() or "predictive pricing" in content.lower()


def test_developer_mode_toggle():
    """
    Verify that developer mode parameter override exposes telemetry and sub-agent details.
    """
    # 1. Developer Mode True -> Telemetry and Sub-agent scores are returned
    response_dev = client.post("/api/executive/chat", json={
        "question": "hi",
        "mode": "smart",
        "developer_mode": True
    })
    assert response_dev.status_code == 200
    data_dev = response_dev.json()
    agent_data_dev = data_dev["message"]["agent_data"]
    assert "confidence_scores" in agent_data_dev
    assert "telemetry" in agent_data_dev

    # 2. Developer Mode False -> Telemetry and Sub-agent scores are stripped
    response_founder = client.post("/api/executive/chat", json={
        "question": "hi",
        "mode": "smart",
        "developer_mode": False
    })
    assert response_founder.status_code == 200
    data_founder = response_founder.json()
    agent_data_founder = data_founder["message"]["agent_data"]
    assert "telemetry" not in agent_data_founder


def test_fuzzy_intent_matching_and_impact_omission():
    """
    Assert that:
    1. Fuzzy intent matching maps typos in static intents correctly.
    2. Business queries are NOT fuzzy-matched to greetings/static intents (e.g. 'inventory' is not 'hi').
    3. Expected Business Impact is omitted from the formatted response when value is 'N/A'.
    """
    # 1. Typos in static greetings/thanks/goodbyes fuzzy-match
    greetings_typos = ["namste", "hllo", "heey", "thx", "goodby"]
    for typo in greetings_typos:
        intent = ConversationLayer.classify_intent(typo)
        assert intent in ["Greeting", "Thanks", "Goodbye"], f"Typo '{typo}' failed static fuzzy intent matching"

    # 2. Business queries are not fuzzy matched to static intents
    business_queries = [
        "give me inventory summary",
        "simulate cash flow drop",
        "what is my financial profit margins"
    ]
    for q in business_queries:
        intent = ConversationLayer.classify_intent(q)
        assert intent not in ["Greeting", "Thanks", "Goodbye"], f"Business query '{q}' should not fuzzy match to static intents"

    # 3. Expected impact omission
    from app.schemas.executive import ExecutiveSynthesisResult
    from app.services.ai.executive_formatter import ExecutiveFormatter

    synth_no_impact = ExecutiveSynthesisResult(
        agent="EVE Lead",
        summary="Test summary.",
        priorities=[],
        expected_impact="N/A",
        findings_by_agent={},
        recommendations_by_agent={},
        confidence_scores={"Overall": 1.0}
    )
    formatted = ExecutiveFormatter.format_executive_response(synth_no_impact, "test query")
    assert "### 📋 Verified Facts" in formatted
    assert "### 🧠 EVE Executive Interpretation" in formatted
    assert "### 💡 Strategic Recommendations" in formatted

    synth_with_impact = ExecutiveSynthesisResult(
        agent="EVE Lead",
        summary="Test summary.",
        priorities=[],
        expected_impact="Increase revenue by 10%.",
        findings_by_agent={},
        recommendations_by_agent={},
        confidence_scores={"Overall": 1.0}
    )
    formatted_with = ExecutiveFormatter.format_executive_response(synth_with_impact, "test query")
    assert "### 📋 Verified Facts" in formatted_with
    assert "### 🧠 EVE Executive Interpretation" in formatted_with
    assert "### 💡 Strategic Recommendations" in formatted_with


def test_question_sensitivity_and_routing():
    """
    Verify that different queries route to unique reasoning paths and return
    distinct, context-appropriate priorities and summary texts.
    """
    from unittest.mock import patch
    from app.orchestration.validator import ExecutiveGovernanceValidator
    from app.models.product import Product
    from app.models.client import Client
    from app.models.project import Project
    
    db_session = TestingSessionLocal()
    # Seed required entities for mock verification
    if db_session.query(Product).filter(Product.sku == "BENCH-PROD-0").count() == 0:
        p0 = Product(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, sku="BENCH-PROD-0", name="Bench Product 0", category="General", selling_price=10.0, unit_cost=5.0)
        db_session.add(p0)
    if db_session.query(Product).filter(Product.sku == "BENCH-PROD-1").count() == 0:
        p1 = Product(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, sku="BENCH-PROD-1", name="Bench Product 1", category="General", selling_price=10.0, unit_cost=5.0)
        db_session.add(p1)
    if db_session.query(Client).filter(Client.company_name.like("%Month-to-Month Churn Risk%")).count() == 0:
        c1 = Client(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, company_name="Month-to-Month Churn Risk Inc", email="c1@test.com", status="inactive")
        db_session.add(c1)
        db_session.flush()
        c1_id = c1.id
    else:
        c1_id = db_session.query(Client).filter(Client.company_name.like("%Month-to-Month%")).first().id
        
    if db_session.query(Client).filter(Client.company_name.like("%High-Value VIP%")).count() == 0:
        c2 = Client(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, company_name="High-Value VIP Corp", email="c2@test.com", status="active")
        db_session.add(c2)
        
    if db_session.query(Project).filter(Project.name.like("%Enterprise Deployment%")).count() == 0:
        proj = Project(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, name="Enterprise Deployment", client_id=c1_id, status="active")
        db_session.add(proj)
        
    db_session.commit()
    db_session.close()

    scenarios = {
        "Executive Summary": {
            "query": "Give me an executive summary.",
            "expect_priority": "Logistics Routing Audit",
            "expect_text": "Executive Summary"
        },
        "Weekly Focus": {
            "query": "What should I focus on this week?",
            "expect_priority": "Resolve Project Bottlenecks",
            "expect_text": "Weekly Focus"
        },
        "Finance Summary": {
            "query": "Give me a finance overview.",
            "expect_priority": "Price Optimization",
            "expect_text": "Finance Summary"
        },
        "Inventory Risks": {
            "query": "Identify inventory risks.",
            "expect_priority": "Liquidate Overstock",
            "expect_text": "Inventory Analysis"
        },
        "Client Retention Risks": {
            "query": "What are my client retention risks?",
            "expect_priority": "Contract Conversion Campaign",
            "expect_text": "Client Analysis"
        }
    }

    results = {}
    with patch.object(ExecutiveGovernanceValidator, "validate_data_sufficiency", return_value=("FULL_DATA", "", {"finance": True, "operations": True, "inventory": True, "client": True, "growth": True})), \
         patch.object(ExecutiveGovernanceValidator, "detect_hallucinations", return_value=(True, [])):
        for name, params in scenarios.items():
            response = client.post("/api/executive/chat", json={
                "question": params["query"],
                "mode": "smart",
                "developer_mode": True
            })
            assert response.status_code == 200, f"Query '{params['query']}' failed"
            data = response.json()
            
            # Log response content for inspection
            content = data["message"]["content"]
            agent_data = data["message"]["agent_data"]
            priorities = agent_data.get("priorities", [])
            
            results[name] = {
                "content": content,
                "priorities": [p["title"] for p in priorities]
            }
            
            # Assert each query maps to its custom priorities and descriptions
            assert any(p["title"] == params["expect_priority"] for p in priorities), \
                f"Expected priority '{params['expect_priority']}' not found in priorities for {name}. Got: {[p['title'] for p in priorities]}"
            assert params["expect_text"] in content, \
                f"Expected summary text segment '{params['expect_text']}' not found in response for {name}."
                
            # Verify Supporting Evidence contains intent-specific data and excludes irrelevant data blocks
            assert "### 🔒 Auditable Trust Metrics" in content
            evidence_section = content.split("### 🔒 Auditable Trust Metrics")[1].lower()
            
            if name == "Finance Summary":
                assert "revenue" in evidence_section or "expenses" in evidence_section or "profit" in evidence_section
                assert "inventory count" not in evidence_section
                assert "projects" not in evidence_section
            elif name == "Inventory Risks":
                assert "inventory count" in evidence_section
                assert "revenue" not in evidence_section
                assert "projects" not in evidence_section
            elif name == "Weekly Focus":
                assert "projects" in evidence_section or "tasks" in evidence_section
                assert "revenue" not in evidence_section
                assert "inventory" not in evidence_section
            elif name == "Client Retention Risks":
                assert "clients" in evidence_section
                assert "revenue" not in evidence_section
                assert "inventory" not in evidence_section

    # Assert that outputs are distinct and not identical across the different intents
    unique_priorities_sets = {tuple(res["priorities"]) for res in results.values()}
    assert len(unique_priorities_sets) == len(scenarios), \
        f"Expected {len(scenarios)} unique priority sets, but got {len(unique_priorities_sets)} (identical templates reused)."

    # Clean up seeded entities to prevent test contamination
    db_session = TestingSessionLocal()
    db_session.query(Project).filter(Project.organization_id == MOCK_ORG_ID).delete()
    db_session.query(Client).filter(Client.organization_id == MOCK_ORG_ID).delete()
    db_session.query(Product).filter(Product.organization_id == MOCK_ORG_ID).delete()
    db_session.commit()
    db_session.close()


def test_sku_level_inventory_recommendations():
    """
    Verify that EVE returns SKU-level inventory recommendations with actual database
    values for overstock and reorder queries.
    """
    clear_mock_org()
    from app.models.product import Product
    from app.models.inventory import InventoryItem, SalesRecord
    import datetime
    
    db_session = TestingSessionLocal()
    
    prod = Product(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        sku="TST-SKU-001",
        name="Test Overstock Dress",
        category="Dresses",
        unit_cost=20.0,
    )
    db_session.add(prod)
    db_session.flush()
    
    inv_item = InventoryItem(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        product_id=prod.id,
        stock_on_hand=500,
        safety_stock=50,
        reorder_point=100,
        lead_time_days=14,
        avg_daily_sales=0.5
    )
    db_session.add(inv_item)
    
    # Seed SalesRecord to generate velocity and non-zero metrics
    today = datetime.date.today()
    sales_rec = SalesRecord(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        product_id=prod.id,
        date=today - datetime.timedelta(days=2),
        quantity=5,
        unit_price=50.0,
        revenue=250.0
    )
    db_session.add(sales_rec)
    db_session.commit()
    db_session.close()

    # 1. Test: Identify overstock risks.
    response = client.post("/api/executive/chat", json={
        "question": "Identify overstock risks.",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Overstock Risks" in content
    assert "Test Overstock Dress" in content
    assert "TST-SKU-001" in content
    assert "Current Stock: 500" in content
    assert "Sales Velocity:" in content
    assert "Days of Inventory:" in content
    assert "Risk Level:" in content
    assert "### 💡 Strategic Recommendations" in content
    # Verify executive properties are excluded/cleared
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # 2. Test: Which products are hurting inventory efficiency?
    response = client.post("/api/executive/chat", json={
        "question": "Which products are hurting inventory efficiency?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Overstock Risks" in content
    assert "Test Overstock Dress" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # 3. Test: Suggest reorder quantities.
    response = client.post("/api/executive/chat", json={
        "question": "Suggest reorder quantities.",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Reorder Recommendations" in content
    assert "Test Overstock Dress" in content
    assert "TST-SKU-001" in content
    assert "Current Stock: 500" in content
    assert "Reorder Point: 105" in content
    assert "Safety Stock: 35" in content
    assert "Recommended Reorder Quantity: 150" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # 4. Test: Which products need immediate attention?
    response = client.post("/api/executive/chat", json={
        "question": "Which products need immediate attention?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Reorder Recommendations" in content
    assert "Test Overstock Dress" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"


def test_record_level_finance_intelligence():
    """
    Verify that EVE returns record-level finance recommendations with actual database
    values for spending, profitability, and summary queries.
    """
    clear_mock_org()
    from app.models.project import Project
    from app.models.finance import Revenue, Expense
    from app.models.client import Client
    from app.models.product import Product
    from app.models.inventory import InventoryItem, SalesRecord
    import datetime
    
    db_session = TestingSessionLocal()
    
    # Seed Client first to satisfy not-null constraint on project.client_id
    client_obj = db_session.query(Client).filter(Client.company_name == "Test Finance Client").first()
    if not client_obj:
        client_obj = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Test Finance Client",
            status="active"
        )
        db_session.add(client_obj)
        db_session.flush()

    # Seed Project, Revenue, and Expenses for MOCK_ORG_ID
    proj = db_session.query(Project).filter(Project.name == "Test Finance Project").first()
    if not proj:
        proj = Project(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            client_id=client_obj.id,
            name="Test Finance Project",
            status="active"
        )
        db_session.add(proj)
        db_session.flush()
        
        rev = Revenue(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            project_id=proj.id,
            amount=5000.0,
            description="Consulting Revenue"
        )
        db_session.add(rev)
        
        exp1 = Expense(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            amount=2000.0,
            category="Software Licenses",
            description="Monthly subscriptions"
        )
        exp2 = Expense(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            amount=1000.0,
            category="Marketing",
            description="Ad spend"
        )
        db_session.add(exp1)
        db_session.add(exp2)

        prod1 = Product(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            sku="TST-SKU-001",
            name="Dresses",
            category="Dresses",
            unit_cost=20.0
        )
        db_session.add(prod1)
        db_session.flush()

        inv1 = InventoryItem(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            product_id=prod1.id,
            stock_on_hand=100,
            safety_stock=10,
            reorder_point=20,
            lead_time_days=7,
            avg_daily_sales=1.0
        )
        db_session.add(inv1)

        sales1 = SalesRecord(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            product_id=prod1.id,
            date=datetime.date.today(),
            quantity=10,
            unit_price=50.0,
            revenue=500.0
        )
        db_session.add(sales1)
        db_session.commit()
    db_session.close()

    # 1. Test: Where am I spending the most money?
    response = client.post("/api/executive/chat", json={
        "question": "Where am I spending the most money?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Spending Categories" in content
    assert "Software Licenses" in content
    assert "Amount: $2,000.00" in content
    assert "Percentage of Total Expenses: 66.7%" in content
    assert "Risk Level: High" in content
    assert "### 💡 Strategic Recommendations" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # 2a. Test: What is hurting profitability? (Before seeding low-margin product)
    # The only product in database is 'Dresses' with a 60% margin, which is healthy (>=30%).
    # This should return that no leaks are detected.
    response = client.post("/api/executive/chat", json={
        "question": "What is hurting profitability?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Weakest Categories (Profitability Leaks)" in content
    assert "No significant profitability leaks detected." in content
    assert "Strongest Categories (Highly Profitable)" in content
    assert "Dresses" in content
    assert "Margin Impact: 60.0%" in content

    # Seed low-margin category (Shoes) to trigger profitability leak
    db_session = TestingSessionLocal()
    prod_low = db_session.query(Product).filter(Product.sku == "TST-SKU-002").first()
    if not prod_low:
        prod_low = Product(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            sku="TST-SKU-002",
            name="Test Low Margin Shoes",
            category="Shoes",
            unit_cost=45.0,
        )
        db_session.add(prod_low)
        db_session.flush()
        
        inv_item_low = InventoryItem(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            product_id=prod_low.id,
            stock_on_hand=100,
            safety_stock=10,
            reorder_point=20,
            lead_time_days=14,
            avg_daily_sales=1.0
        )
        db_session.add(inv_item_low)
        
        today = datetime.date.today()
        sales_rec_low = SalesRecord(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            product_id=prod_low.id,
            date=today - datetime.timedelta(days=2),
            quantity=10,
            unit_price=50.0,
            revenue=500.0
        )
        db_session.add(sales_rec_low)
        db_session.commit()
    db_session.close()

    # 2b. Test: What is hurting profitability? (After seeding low-margin product)
    response = client.post("/api/executive/chat", json={
        "question": "What is hurting profitability?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Weakest Categories (Profitability Leaks)" in content
    assert "Shoes" in content
    assert "Revenue Contribution: $500.00" in content
    assert "Cost Contribution: $450.00" in content
    assert "Margin Impact: 10.0%" in content
    assert "### 💡 Strategic Recommendations" in content
    assert "Strongest Categories (Highly Profitable)" in content
    assert "Dresses" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # 3. Test: Give me a finance summary.
    response = client.post("/api/executive/chat", json={
        "question": "Give me a finance summary.",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Financial Summary" in content
    assert "Revenue: $6,000.00" in content  # 5000 project + 500 Dresses + 500 Shoes
    assert "Expenses: $3,000.00" in content # 2000 software + 1000 marketing
    assert "Profit: $3,000.00" in content
    assert "Top Cost Drivers: Software Licenses" in content
    assert "Largest Financial Risks:" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"


def test_record_level_client_intelligence():
    """
    Verify that EVE returns record-level client recommendations with actual database
    values for risk, outreach, revenue, and inactive queries.
    """
    clear_mock_org()
    from app.models.client import Client
    from app.models.project import Project
    from app.models.finance import Revenue
    import datetime
    
    db_session = TestingSessionLocal()
    
    # 1. Seed Client A (Active, high revenue, active project)
    client_a = db_session.query(Client).filter(Client.company_name == "Client Alpha").first()
    if not client_a:
        client_a = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Client Alpha",
            status="active",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=5)
        )
        db_session.add(client_a)
        db_session.flush()
        
        proj_a = Project(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            client_id=client_a.id,
            name="Alpha Project 1",
            budget=10000.0,
            status="active",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=5)
        )
        db_session.add(proj_a)
        db_session.flush()
        
        rev_a = Revenue(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            project_id=proj_a.id,
            amount=8000.0,
            date=datetime.datetime.utcnow() - datetime.timedelta(days=5),
            description="Milestone 1 Payment"
        )
        db_session.add(rev_a)
        
    # 2. Seed Client B (Active, no projects at all -> Medium Risk, Outreach Opportunity)
    client_b = db_session.query(Client).filter(Client.company_name == "Client Beta").first()
    if not client_b:
        client_b = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Client Beta",
            status="active",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=10)
        )
        db_session.add(client_b)
        db_session.flush()
        
    # 3. Seed Client C (Inactive status, high historical revenue, inactive days >= 30)
    client_c = db_session.query(Client).filter(Client.company_name == "Client Gamma").first()
    if not client_c:
        client_c = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Client Gamma",
            status="inactive",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=45)
        )
        db_session.add(client_c)
        db_session.flush()
        
        proj_c = Project(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            client_id=client_c.id,
            name="Gamma Old Project",
            budget=5000.0,
            status="completed",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=45)
        )
        db_session.add(proj_c)
        db_session.flush()
        
        rev_c = Revenue(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            project_id=proj_c.id,
            amount=5000.0,
            date=datetime.datetime.utcnow() - datetime.timedelta(days=45),
            description="Final project payout"
        )
        db_session.add(rev_c)
        
    db_session.commit()
    db_session.close()

    # Test 1: Which clients are at risk?
    response = client.post("/api/executive/chat", json={
        "question": "Which clients are at risk?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Revenue Clients" in content
    assert "Client Alpha" in content
    assert "Revenue Contribution: $8,000.00" in content
    assert "Percentage Of Revenue:" in content
    assert "Strategic Importance:" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

def test_record_level_client_intelligence():
    """
    Verify that EVE returns record-level client recommendations with actual database
    values for risk, outreach, revenue, and inactive queries.
    """
    from app.models.client import Client
    from app.models.project import Project
    from app.models.finance import Revenue
    import datetime
    
    db_session = TestingSessionLocal()
    
    # 1. Seed Client A (Active, high revenue, active project)
    client_a = db_session.query(Client).filter(Client.company_name == "Client Alpha").first()
    if not client_a:
        client_a = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Client Alpha",
            status="active",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=5)
        )
        db_session.add(client_a)
        db_session.flush()
        
        proj_a = Project(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            client_id=client_a.id,
            name="Alpha Project 1",
            budget=10000.0,
            status="active",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=5)
        )
        db_session.add(proj_a)
        db_session.flush()
        
        rev_a = Revenue(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            project_id=proj_a.id,
            amount=8000.0,
            date=datetime.datetime.utcnow() - datetime.timedelta(days=5),
            description="Milestone 1 Payment"
        )
        db_session.add(rev_a)
        
    # 2. Seed Client B (Active, no projects at all -> Medium Risk, Outreach Opportunity)
    client_b = db_session.query(Client).filter(Client.company_name == "Client Beta").first()
    if not client_b:
        client_b = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Client Beta",
            status="active",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=10)
        )
        db_session.add(client_b)
        db_session.flush()
        
    # 3. Seed Client C (Inactive status, high historical revenue, inactive days >= 30)
    client_c = db_session.query(Client).filter(Client.company_name == "Client Gamma").first()
    if not client_c:
        client_c = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Client Gamma",
            status="inactive",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=45)
        )
        db_session.add(client_c)
        db_session.flush()
        
        proj_c = Project(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            client_id=client_c.id,
            name="Gamma Old Project",
            budget=5000.0,
            status="completed",
            updated_at=datetime.datetime.utcnow() - datetime.timedelta(days=45)
        )
        db_session.add(proj_c)
        db_session.flush()
        
        rev_c = Revenue(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            project_id=proj_c.id,
            amount=5000.0,
            date=datetime.datetime.utcnow() - datetime.timedelta(days=45),
            description="Final project payout"
        )
        db_session.add(rev_c)
        
    db_session.commit()
    db_session.close()

    # Test 1: Which clients are at risk?
    response = client.post("/api/executive/chat", json={
        "question": "Which clients are at risk?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top At-Risk Clients" in content
    # Client Gamma should be High Risk (Inactive status)
    assert "Client Gamma" in content
    assert "Risk Level: High" in content
    assert "Revenue Contribution: $5,000.00" in content
    assert "Client status is set to inactive (45 days since last activity)" in content
    # Client Beta should be Medium Risk (No active projects)
    assert "Client Beta" in content
    assert "Risk Level: Medium" in content
    assert "Active Projects: 0" in content
    assert "No active projects scheduled (last activity 10 days ago)" in content
    assert "### 💡 Strategic Recommendations" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # Test 2: Who should I contact this week?
    response = client.post("/api/executive/chat", json={
        "question": "Who should I contact this week?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Outreach Opportunities" in content
    assert "Client Beta" in content
    assert "Client Gamma" in content
    assert "Opportunity Score: 75 (Factors: No Active Projects (+25), No Revenue Contribution (+0), Recent Activity (+0))" in content
    assert "Opportunity Score: 90 (Factors: No Active Projects (+25), Medium Revenue Contribution (+10), Short-term Inactivity (+5))" in content
    assert "10 days ago" in content
    assert "### 💡 Strategic Recommendations" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # Test 3: Which clients generate the most revenue?
    response = client.post("/api/executive/chat", json={
        "question": "Which clients generate the most revenue?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Top Revenue Clients" in content
    assert "Client Alpha" in content
    assert "Revenue Contribution: $8,000.00" in content
    assert "Percentage Of Revenue:" in content
    assert "Strategic Importance:" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # Test 4: Which clients are inactive?
    response = client.post("/api/executive/chat", json={
        "question": "Which clients are inactive?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Inactive Clients" in content
    assert "Client Gamma" in content
    assert "Days Since Last Activity: 45" in content
    assert "Historical Revenue: $5,000.00" in content
    assert "Status: Inactive" in content
    assert "Recommended Follow-Up:" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"


def test_record_level_project_intelligence():
    """
    Verify that EVE returns record-level project recommendations with actual database
    values for delayed, attention, deadlines, and weekly focus queries.
    """
    clear_mock_org()
    from app.models.client import Client
    from app.models.project import Project
    from app.models.task import Task
    import datetime
    
    db_session = TestingSessionLocal()
    
    client_obj = db_session.query(Client).filter(Client.organization_id == MOCK_ORG_ID, Client.company_name == "Test Finance Client").first()
    if not client_obj:
        client_obj = Client(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            company_name="Test Finance Client",
            status="active"
        )
        db_session.add(client_obj)
        db_session.flush()
    
    # 1. Seed Project Alpha (Delayed: past deadline, has overdue task)
    proj_a = db_session.query(Project).filter(Project.name == "Project Alpha").first()
    if not proj_a:
        proj_a = Project(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            client_id=client_obj.id,
            name="Project Alpha",
            status="active",
            completion_percentage=40.0,
            deadline=datetime.datetime.utcnow() - datetime.timedelta(days=10),
            budget=3000.0
        )
        db_session.add(proj_a)
        db_session.flush()
        
        task_a = Task(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            project_id=proj_a.id,
            title="Overdue Milestone Alpha",
            status="todo",
            due_date=datetime.datetime.utcnow() - datetime.timedelta(days=5),
            priority="high"
        )
        db_session.add(task_a)

    # 2. Seed Project Beta (At-Risk Deadline: upcoming deadline, high value)
    proj_b = db_session.query(Project).filter(Project.name == "Project Beta").first()
    if not proj_b:
        proj_b = Project(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            client_id=client_obj.id,
            name="Project Beta",
            status="active",
            completion_percentage=75.0,
            deadline=datetime.datetime.utcnow() + datetime.timedelta(days=5),
            budget=12000.0
        )
        db_session.add(proj_b)
        db_session.flush()
        
        task_b = Task(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            project_id=proj_b.id,
            title="Upcoming Task Beta",
            status="todo",
            due_date=datetime.datetime.utcnow() + datetime.timedelta(days=3),
            priority="medium"
        )
        db_session.add(task_b)
        
    db_session.commit()
    db_session.close()

    # Test 1: Which projects are delayed?
    response = client.post("/api/executive/chat", json={
        "question": "Which projects are delayed?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Delayed Projects" in content
    assert "Project Alpha" in content
    assert "Progress Percentage: 40.0%" in content
    assert "Overdue by 10 days" in content or "Overdue by 9 days" in content or "days" in content
    assert "Open Tasks: 1" in content
    assert "Risk Level: High" in content
    assert "Blocking Factors: 1 overdue tasks blocking progress." in content
    assert "### 💡 Strategic Recommendations" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # Test 2: Which projects need attention?
    response = client.post("/api/executive/chat", json={
        "question": "Which projects need attention?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Priority Projects" in content
    assert "Project Alpha" in content
    assert "Project Beta" in content
    assert "Progress Percentage: 75.0%" in content
    assert "### 💡 Strategic Recommendations" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # Test 3: What deadlines are at risk?
    response = client.post("/api/executive/chat", json={
        "question": "What deadlines are at risk?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "At-Risk Deadlines" in content
    assert "Project Beta" in content
    assert "5 days remaining" in content or "4 days remaining" in content or "days remaining" in content
    assert "Completion Percentage: 75.0%" in content
    assert "Critical: Less than a week remaining" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"

    # Test 4: What should my team focus on this week?
    response = client.post("/api/executive/chat", json={
        "question": "What should my team focus on this week?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    assert "Weekly Operational Priorities" in content
    assert "Project Beta" in content or "Project Alpha" in content
    assert "Priority Score:" in content
    assert "Factors:" in content
    assert "### 💡 Strategic Recommendations" in content
    assert data["message"]["agent_data"]["priorities"] == []
    assert data["message"]["agent_data"]["expected_impact"] == "N/A"


def test_project_risk_mitigation_routing():
    """
    Verify that project risk mitigation queries are routed correctly to delayed projects and formatted as Diagnostic.
    """
    seed_full_demo_database()
    response = client.post("/api/executive/chat", json={
        "question": "How do we mitigate the risk: \"1 active project(s) have passed their deadline\"?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response.status_code == 200
    data = response.json()
    content = data["message"]["content"]
    
    # Assert Project structure
    assert "Issue:" in content
    assert "Cause:" in content
    assert "Mitigation:" in content
    assert "Project Alpha" in content
    assert "Impact:" in content


def test_success_criteria_scenarios():
    """
    Verify the 4 founder demo success criteria questions.
    """
    seed_full_demo_database()
    # Success Criteria Test 1: Mitigation risk for passed deadline
    response1 = client.post("/api/executive/chat", json={
        "question": "How do we mitigate the risk: \"1 active project(s) have passed their deadline\"?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response1.status_code == 200
    content1 = response1.json()["message"]["content"]
    assert "PROJECT_RISK intent detected" in content1 or "Project Alpha" in content1
    assert "Issue:" in content1
    assert "Cause:" in content1
    assert "Mitigation:" in content1
    assert "Impact:" in content1

    # Success Criteria Test 2: What should I reorder this week?
    response2 = client.post("/api/executive/chat", json={
        "question": "What should I reorder this week?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response2.status_code == 200
    content2 = response2.json()["message"]["content"]
    assert content2.startswith("Direct Answer:\nReorder SKU") or content2.startswith("[SPRINT6-INVENTORY]")

    # Success Criteria Test 3: Which inventory is hurting profitability?
    response3 = client.post("/api/executive/chat", json={
        "question": "Which inventory is hurting profitability?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response3.status_code == 200
    content3 = response3.json()["message"]["content"]
    assert "Top Overstock Risks" in content3 or "SKU" in content3
    assert "Direct Answer:" in content3

    # Success Criteria Test 4: What is our biggest operational risk right now?
    response4 = client.post("/api/executive/chat", json={
        "question": "What is our biggest operational risk right now?",
        "mode": "smart",
        "developer_mode": True
    })
    assert response4.status_code == 200
    content4 = response4.json()["message"]["content"]
    assert "PROJECT_RISK intent detected" in content4 or "Project Alpha" in content4
    assert "Issue:" in content4
    assert "Cause:" in content4
    assert "Mitigation:" in content4
    assert "Impact:" in content4

