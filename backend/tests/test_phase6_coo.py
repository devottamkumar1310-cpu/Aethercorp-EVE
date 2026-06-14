import pytest
import uuid
import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.models.finance import Revenue, Expense
from app.models.future import Forecast
from app.models.ai_recommendation import AIRecommendation
from app.services.analytics_service import AnalyticsService
from app.services.forecasting_engine import ForecastingEngine
from app.services.confidence_engine import ConfidenceEngine
from app.services.simulation_engine import SimulationEngine
from app.core.security import get_current_user

# 1. Setup in-memory SQLite database
SQL_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQL_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

MOCK_ORG_ID = uuid.uuid4()
MOCK_USER_ID = uuid.uuid4()

# Seed basic tenant data
db = TestingSessionLocal()
profile = Profile(id=MOCK_USER_ID, email="coo_tester@example.com", full_name="COO Tester", hashed_password="pw")
org = Organization(id=MOCK_ORG_ID, name="COO Test Org", slug="coo-org")
membership = Membership(user_id=MOCK_USER_ID, organization_id=MOCK_ORG_ID, role="admin")
db.add(profile)
db.add(org)
db.add(membership)
db.commit()
db.close()


def override_get_db():
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()


def mock_get_current_user():
    db_session = TestingSessionLocal()
    user = db_session.query(Profile).filter(Profile.id == MOCK_USER_ID).first()
    db_session.close()
    return user


@pytest.fixture(autouse=True)
def setup_dependency_overrides():
    old_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)


client = TestClient(app)


def test_forecasting_methodologies():
    """
    Verify statistical forecasting calculations: Moving Average, Weighted Moving Average, and Exponential Smoothing.
    """
    sales = [10.0, 12.0, 11.0, 15.0, 13.0, 14.0, 16.0]
    
    # 1. Moving Average
    ma_result = ForecastingEngine.moving_average(sales, window=3)
    assert len(ma_result) == len(sales)
    # last forecast should be average of [13, 14, 16] = 14.33
    assert abs(ma_result[-1] - 14.33) < 0.1
    
    # 2. Weighted Moving Average
    wma_result = ForecastingEngine.weighted_moving_average(sales, window=3)
    assert len(wma_result) == len(sales)
    # last forecast should be (13*1 + 14*2 + 16*3)/6 = (13 + 28 + 48)/6 = 89/6 = 14.83
    assert abs(wma_result[-1] - 14.83) < 0.1
    
    # 3. Exponential Smoothing
    es_result = ForecastingEngine.exponential_smoothing(sales, alpha=0.3)
    assert len(es_result) == len(sales)
    
    # 4. Forecast Next 30 Days API
    forecast_res = ForecastingEngine.forecast_next_30_days(sales, method="exponential_smoothing")
    assert forecast_res["method_used"] == "exponential_smoothing"
    assert "assumptions" in forecast_res
    assert forecast_res["forecasted_quantity"] > 0


def test_confidence_calculations():
    """
    Verify that confidence scores are calculated deterministically from database metrics.
    """
    db_session = TestingSessionLocal()
    
    # Low data state should yield a baseline score
    low_data_confidence = ConfidenceEngine.calculate_deterministic_confidence("price_change", db_session, MOCK_ORG_ID)
    assert low_data_confidence == 0.3  # Base 0.50 minus price_change penalty (0.05) minus cash unknown penalty (0.15)
    
    # Seed 600 sales records to boost confidence
    product_id = uuid.uuid4()
    prod = Product(id=product_id, organization_id=MOCK_ORG_ID, sku="SKU-CONF-1", name="Conf Product", category="Outerwear", unit_cost=10.0, selling_price=20.0)
    db_session.add(prod)
    
    for i in range(150):
        rec = SalesRecord(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            product_id=product_id,
            quantity=10,
            unit_price=20.0,
            revenue=200.0,
            date=datetime.date.today()
        )
        db_session.add(rec)
    
    # Add inventory item
    inv = InventoryItem(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        product_id=product_id,
        stock_on_hand=50,
        lead_time_days=10,
        avg_daily_sales=1.0,
        safety_stock=10,
        reorder_point=20
    )
    db_session.add(inv)
    
    # Add client and project
    from app.models.client import Client
    from app.models.project import Project
    client_id = uuid.uuid4()
    client = Client(id=client_id, organization_id=MOCK_ORG_ID, company_name="Test Client 1", email="c1@test.com", status="active")
    db_session.add(client)
    db_session.flush()

    proj_id = uuid.uuid4()
    proj = Project(id=proj_id, organization_id=MOCK_ORG_ID, name="Test Project 1", client_id=client_id, status="active")
    db_session.add(proj)
    db_session.flush()

    # Add revenue and expense records
    rev = Revenue(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, project_id=proj_id, amount=12000.0, date=datetime.datetime.utcnow(), description="Sales")
    exp = Expense(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, amount=2000.0, category="Rent", date=datetime.datetime.utcnow(), description="Rent")
    db_session.add(rev)
    db_session.add(exp)
    db_session.commit()
    
    high_data_confidence = ConfidenceEngine.calculate_deterministic_confidence("demand_growth", db_session, MOCK_ORG_ID)
    # Should boost based on sales_count > 100 (+0.1) and product_count and inventory_count
    assert high_data_confidence > low_data_confidence
    
    # Cleanup
    db_session.query(SalesRecord).filter(SalesRecord.organization_id == MOCK_ORG_ID).delete()
    db_session.delete(inv)
    db_session.delete(prod)
    db_session.delete(rev)
    db_session.delete(exp)
    db_session.delete(proj)
    db_session.delete(client)
    db_session.commit()
    db_session.close()


def test_dashboard_forecast_panel():
    """
    Verify dashboard includes forecasting panel variables (available/required capital, gaps, risk scores).
    """
    headers = {"X-Workspace-Id": str(MOCK_ORG_ID)}
    
    # Seed mock inventory to get recommendations
    db_session = TestingSessionLocal()
    product_id = uuid.uuid4()
    prod = Product(id=product_id, organization_id=MOCK_ORG_ID, sku="SKU-DASH-1", name="Dash Product", category="Basics", unit_cost=10.0, selling_price=15.0)
    inv = InventoryItem(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, product_id=product_id, stock_on_hand=5, lead_time_days=7, avg_daily_sales=2.0, safety_stock=15, reorder_point=25)
    
    # Add sales records
    for i in range(10):
        rec = SalesRecord(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            product_id=product_id,
            quantity=2,
            unit_price=15.0,
            revenue=30.0,
            date=datetime.date.today() - datetime.timedelta(days=i)
        )
        db_session.add(rec)
        
    db_session.add(prod)
    db_session.add(inv)
    db_session.commit()
    
    response = client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    metrics = response.json()
    
    # Assert forecast panel fields are present
    assert "inventory_capital_requirements" in metrics
    assert "revenue_forecast" in metrics
    assert "risk_forecast" in metrics
    assert "required_capital" in metrics
    assert "available_capital" in metrics
    assert "capital_gap" in metrics
    assert "top_3_actions" in metrics
    
    # Assert top_3_actions is prioritized (first key in JSON dictionary response)
    metrics_keys = list(metrics.keys())
    assert metrics_keys[0] == "top_3_actions"
    
    # Assert risk forecast dictionary contains correct risk scores
    assert "stockout_risk" in metrics["risk_forecast"]
    assert "cash_risk" in metrics["risk_forecast"]
    assert "inventory_risk" in metrics["risk_forecast"]
    assert "margin_risk" in metrics["risk_forecast"]
    
    # Assert actions contain confidence scores and explanations
    for action in metrics["top_3_actions"]:
        assert "confidence" in action
        assert "confidence_score" in action
        assert "why" in action
        assert "explanation" in action
        assert "expected_impact" in action
        assert "impact" in action
        assert "action" in action
        
    # Cleanup
    db_session.query(SalesRecord).filter(SalesRecord.organization_id == MOCK_ORG_ID).delete()
    db_session.delete(inv)
    db_session.delete(prod)
    db_session.commit()
    db_session.close()


def test_scenario_execution_and_comparison():
    """
    Verify all 5 forecast scenarios run correctly and their results are stored in the database.
    """
    db_session = TestingSessionLocal()
    
    # 1. Price Increase Scenario
    price_res = SimulationEngine.simulate_price_change(10.0, MOCK_ORG_ID, db_session)
    assert price_res["scenario"] == "Price Change"
    assert "assumptions" in price_res
    
    # 2. Demand Growth Scenario
    growth_res = SimulationEngine.simulate_demand_growth(20.0, MOCK_ORG_ID, db_session)
    assert growth_res["scenario"] == "Demand Growth"
    
    # 3. Demand Decline Scenario
    decline_res = SimulationEngine.simulate_demand_decline(30.0, MOCK_ORG_ID, db_session)
    assert decline_res["scenario"] == "Demand Decline"
    
    # 4. Inventory Expansion Scenario
    expansion_res = SimulationEngine.simulate_inventory_expansion(1000, MOCK_ORG_ID, db_session)
    assert expansion_res["scenario"] == "Inventory Expansion"
    
    # 5. Cash Flow Scenario
    cash_res = SimulationEngine.simulate_cash_flow_forecast(30, MOCK_ORG_ID, db_session)
    assert cash_res["scenario"] == "Cash Flow Forecast"
    
    # Assert scenarios were stored in DB
    forecasts = db_session.query(Forecast).filter(Forecast.organization_id == MOCK_ORG_ID).all()
    # At least 5 forecasts saved
    assert len(forecasts) >= 5
    
    # Verify scenarios API route
    headers = {"X-Workspace-Id": str(MOCK_ORG_ID)}
    api_res = client.get("/api/executive/scenarios", headers=headers)
    assert api_res.status_code == 200
    history = api_res.json()
    assert len(history) >= 5
    assert "scenario_type" in history[0]
    
    # Cleanup DB scenario logs
    db_session.query(Forecast).filter(Forecast.organization_id == MOCK_ORG_ID).delete()
    db_session.commit()
    db_session.close()


def test_scenario_chat_interactions():
    """
    Verify smart routing classifier routes scenario questions and returns deterministic tradeoffs and actions.
    """
    headers = {"X-Workspace-Id": str(MOCK_ORG_ID)}
    db_session = TestingSessionLocal()
    
    # Seed data for validation checks
    from app.models.client import Client as DBClient
    from app.models.project import Project as DBProject
    from app.models.task import Task
    from app.models.product import Product
    from app.models.inventory import InventoryItem
    from app.models.finance import Revenue
    
    client_id = uuid.uuid4()
    client_model_rec = DBClient(id=client_id, organization_id=MOCK_ORG_ID, company_name="Test Client 2", email="c2@test.com", status="active")
    db_session.add(client_model_rec)
    db_session.flush()

    proj_id = uuid.uuid4()
    proj = DBProject(id=proj_id, organization_id=MOCK_ORG_ID, name="Test Project 2", client_id=client_id, status="active")
    db_session.add(proj)
    db_session.flush()

    task = Task(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, project_id=proj_id, title="Test Task 2", status="completed")
    db_session.add(task)
    
    rev = Revenue(id=uuid.uuid4(), organization_id=MOCK_ORG_ID, project_id=proj_id, amount=5000.0, date=datetime.datetime.utcnow(), description="Sales")
    db_session.add(rev)
    
    prod_id = uuid.uuid4()
    prod = Product(id=prod_id, organization_id=MOCK_ORG_ID, sku="SKU-CHAT-1", name="Chat Product", category="Outerwear", unit_cost=10.0, selling_price=20.0)
    db_session.add(prod)
    db_session.flush()
    
    inv = InventoryItem(
        id=uuid.uuid4(),
        organization_id=MOCK_ORG_ID,
        product_id=prod_id,
        stock_on_hand=50,
        lead_time_days=10,
        avg_daily_sales=1.0,
        safety_stock=10,
        reorder_point=20
    )
    db_session.add(inv)
    
    # Seed sales records
    for i in range(10):
        rec = SalesRecord(
            id=uuid.uuid4(),
            organization_id=MOCK_ORG_ID,
            product_id=prod_id,
            quantity=5,
            unit_price=20.0,
            revenue=100.0,
            date=datetime.date.today() - datetime.timedelta(days=i)
        )
        db_session.add(rec)
        
    db_session.commit()
    
    payloads = [
        {"question": "What happens if sales increase 20%?", "type": "demand_growth"},
        {"question": "What happens if demand drops 30%?", "type": "demand_decline"},
        {"question": "What happens if prices increase 10%?", "type": "price_change"},
        {"question": "What should I do next month?", "type": "cash_flow_forecast"}
    ]
    
    # We will test in smart mode, forcing fallback to ensure deterministic execution trace
    from app.core.dependency_container import container
    gemini_service = container.get("gemini_service")
    original_generate_structured = gemini_service.generate_structured_response
    original_mock_mode = gemini_service.mock_mode

    async def mock_raise_429(*args, **kwargs):
        raise Exception("429 Quota Exceeded")

    gemini_service.generate_structured_response = mock_raise_429
    gemini_service.mock_mode = False
    
    try:
        for payload in payloads:
            response = client.post("/api/executive/chat", json=payload, headers=headers)
            assert response.status_code == 200
            data = response.json()
            
            assert "message" in data
            # Response summary should contain mathematical numbers and fallback label
            assert "fallback" in data["message"]["content"].lower()
            
            # Priorities (actions) must contain exact deterministic entries
            agent_data = data["message"]["agent_data"]
            assert "priorities" in agent_data
            assert len(agent_data["priorities"]) == 3
            
            # Verify confidence category and risk logic
            assert "confidence_category" in agent_data
            assert "risk_classification" in agent_data
    finally:
        gemini_service.generate_structured_response = original_generate_structured
        gemini_service.mock_mode = original_mock_mode
        # Cleanup
        db_session.query(SalesRecord).filter(SalesRecord.organization_id == MOCK_ORG_ID).delete()
        db_session.delete(inv)
        db_session.delete(prod)
        db_session.delete(rev)
        db_session.delete(task)
        db_session.delete(proj)
        db_session.delete(client_model_rec)
        db_session.commit()
        db_session.close()


def test_generic_query_429_fallback():
    """
    Regression test: Verify that confidence metadata (confidence_category and risk_classification)
    is preserved in agent_data during a 429 fallback scenario for generic/non-scenario queries.
    """
    headers = {"X-Workspace-Id": str(MOCK_ORG_ID)}
    
    from app.core.dependency_container import container
    gemini_service = container.get("gemini_service")
    original_generate_structured = gemini_service.generate_structured_response
    original_mock_mode = gemini_service.mock_mode

    async def mock_raise_429(*args, **kwargs):
        raise Exception("429 Quota Exceeded")

    gemini_service.generate_structured_response = mock_raise_429
    gemini_service.mock_mode = False

    try:
        response = client.post("/api/executive/chat", json={"question": "What is my general business health?"}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        agent_data = data["message"]["agent_data"]
        
        # Verify confidence category and risk classification are present in agent_data
        assert "confidence_category" in agent_data
        assert "risk_classification" in agent_data
    finally:
        gemini_service.generate_structured_response = original_generate_structured
        gemini_service.mock_mode = original_mock_mode
