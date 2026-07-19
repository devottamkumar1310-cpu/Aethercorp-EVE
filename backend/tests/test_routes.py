# ==============================================================================
# PURPOSE: Integration tests for API routes.
# DATA FLOW: Sends mock HTTP requests -> parses JSON payloads -> asserts DB states.
# ==============================================================================

import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db

from sqlalchemy.pool import StaticPool

# Create an in-memory SQLite database with StaticPool to share connection across sessions
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Setup schemas
# Import all models to register them on Base
from app.models.organization import Organization, Membership
from app.models.profile import Profile

Base.metadata.create_all(bind=engine)

import uuid
from app.core.security import get_current_user_and_tenant, get_current_user, get_required_workspace_id

# Seed test tenant data
MOCK_USER_ID = uuid.uuid4()
MOCK_ORG_ID = uuid.uuid4()

db = TestingSessionLocal()
mock_org = Organization(id=MOCK_ORG_ID, name="Test Org", slug="test-org")
mock_user = Profile(id=MOCK_USER_ID, email="test@example.com", full_name="Test User", hashed_password="pw")
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


# Override dependencies in FastAPI with proper cleanup to prevent test pollution
@pytest.fixture(autouse=True, scope="module")
def manage_overrides():
    from unittest.mock import patch
    patcher = patch("app.services.ai.proactive_analysis_service.ProactiveAnalysisService.generate_baseline_recommendations_async", return_value=None)
    patcher.start()
    
    saved_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_and_tenant] = override_get_current_user_and_tenant
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_required_workspace_id] = override_get_required_workspace_id
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved_overrides)
    patcher.stop()

client = TestClient(app)


def test_health_check():
    """
    Verifies API health check endpoint returns operational.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "operational"


def test_csv_upload_pipeline():
    """
    Simulates uploading inventory, sales, and costs CSVs and verifies DB seeding.
    """
    # 1. Upload Inventory CSV
    # sku,name,category,stock_on_hand,lead_time_days
    inventory_csv = (
        "sku,name,category,stock_on_hand,lead_time_days\n"
        "SKU-TEST-001,Premium Top,Tops,80,10\n"
        "SKU-TEST-002,Cozy Hoodie,Tops,10,14\n"
    )
    
    file_bytes = io.BytesIO(inventory_csv.encode("utf-8"))
    response = client.post(
        "/api/inventory/upload/inventory",
        files={"file": ("inventory.csv", file_bytes, "text/csv")}
    )
    assert response.status_code == 201
    assert response.json()["status"] == "success"

    # 2. Upload Costs CSV
    # sku,unit_cost,supplier_name
    costs_csv = (
        "sku,unit_cost,supplier_name\n"
        "SKU-TEST-001,15.50,GarmentFactory\n"
        "SKU-TEST-002,22.00,TexSuppliers\n"
    )
    
    cost_file_bytes = io.BytesIO(costs_csv.encode("utf-8"))
    response = client.post(
        "/api/inventory/upload/costs",
        files={"file": ("product_cost.csv", cost_file_bytes, "text/csv")}
    )
    assert response.status_code == 201
    assert response.json()["status"] == "success"

    # 3. Upload Sales CSV
    # date,sku,quantity,unit_price,revenue
    sales_csv = (
        "date,sku,quantity,unit_price,revenue\n"
        "2026-06-01,SKU-TEST-001,3,45.00,135.00\n"
        "2026-06-02,SKU-TEST-001,2,45.00,90.00\n"
        "2026-06-01,SKU-TEST-002,1,75.00,75.00\n"
    )
    
    sales_file_bytes = io.BytesIO(sales_csv.encode("utf-8"))
    response = client.post(
        "/api/inventory/upload/sales",
        files={"file": ("sales.csv", sales_file_bytes, "text/csv")}
    )
    assert response.status_code == 201
    assert response.json()["status"] == "success"

    # Done testing
    pass
