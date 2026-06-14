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


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_dependencies():
    # Ensure gemini_service is registered in container
    service = container.get_optional("gemini_service")
    if not service:
        service = GeminiService()
        container.register_singleton("gemini_service", service)
    service.mock_mode = True

    # Set dependency overrides dynamically
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_and_tenant] = override_get_current_user_and_tenant
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_required_workspace_id] = override_get_required_workspace_id
    
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
        assert "telemetry" not in data["message"]["agent_data"]
        assert "confidence_scores" not in data["message"]["agent_data"]


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
    assert "confidence_scores" not in agent_data_founder
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
    assert "### 3. Expected Impact" not in formatted, "Expected Impact section should be omitted when value is 'N/A'"

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
    assert "### 3. Expected Impact" in formatted_with, "Expected Impact section should be included when a value is present"

