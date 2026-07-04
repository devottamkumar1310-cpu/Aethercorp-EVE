import pytest
import uuid
import datetime
import jwt
from fastapi import status
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
from app.core.security import get_current_user, get_required_workspace_id
from app.config import settings
from app.core.dependency_container import container

# Setup isolated in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()

@pytest.fixture(autouse=True, scope="module")
def manage_dependency_overrides():
    from app.core.security import verify_supabase_token, get_current_user_and_tenant
    # Save a copy of global overrides
    saved_overrides = app.dependency_overrides.copy()
    
    # Remove overrides for authentication and db dependencies that we want to run realistically
    for dep in [get_db, get_current_user, get_required_workspace_id, verify_supabase_token, get_current_user_and_tenant]:
        app.dependency_overrides.pop(dep, None)
        
    # Set our specific db override
    app.dependency_overrides[get_db] = override_get_db
    
    yield
    
    # Restore the original global overrides exactly as they were
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved_overrides)

@pytest.fixture(scope="module")
def seeded_data():
    db = TestingSessionLocal()
    
    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()
    
    admin_id = uuid.uuid4()
    member_id = uuid.uuid4()
    other_id = uuid.uuid4()
    
    # 1. Profiles
    admin_profile = Profile(id=admin_id, email="admin@org-a.com", full_name="Org A Admin", hashed_password="pw")
    member_profile = Profile(id=member_id, email="member@org-a.com", full_name="Org A Member", hashed_password="pw")
    other_profile = Profile(id=other_id, email="admin@org-b.com", full_name="Org B Admin", hashed_password="pw")
    
    # 2. Organizations
    org_a = Organization(id=org_a_id, name="Org A", slug="org-a")
    org_b = Organization(id=org_b_id, name="Org B", slug="org-b")
    
    # 3. Memberships
    m_admin = Membership(user_id=admin_id, organization_id=org_a_id, role="admin")
    m_member = Membership(user_id=member_id, organization_id=org_a_id, role="member")
    m_other = Membership(user_id=other_id, organization_id=org_b_id, role="admin")
    
    db.add_all([admin_profile, member_profile, other_profile, org_a, org_b, m_admin, m_member, m_other])
    db.commit()
    
    # Seed a product and sale in Org A for analytics verification
    prod = Product(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        sku="SKU-TEST-ANALYTICS",
        name="Test Analytics Product",
        category="Apparel",
        unit_cost=10.0,
        selling_price=11.0 # 9.09% margin (<15%) -> should trigger low margin alert
    )
    db.add(prod)
    db.flush()
    
    inv = InventoryItem(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        product_id=prod.id,
        stock_on_hand=50,
        lead_time_days=10
    )
    db.add(inv)
    
    # Also seed a dead stock product
    dead_prod = Product(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        sku="SKU-DEAD-STOCK",
        name="Dead Stock Product",
        category="Accessories",
        unit_cost=20.0,
        selling_price=40.0
    )
    db.add(dead_prod)
    db.flush()
    
    dead_inv = InventoryItem(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        product_id=dead_prod.id,
        stock_on_hand=10,
        lead_time_days=10
    )
    db.add(dead_inv)
    
    # Seed a sales record only for the first product
    sale = SalesRecord(
        id=uuid.uuid4(),
        organization_id=org_a_id,
        product_id=prod.id,
        quantity=5,
        unit_price=11.0,
        revenue=55.0,
        date=datetime.date.today()
    )
    db.add(sale)
    db.commit()
    
    db.close()
    
    return {
        "org_a_id": org_a_id,
        "org_b_id": org_b_id,
        "admin_id": admin_id,
        "member_id": member_id,
        "other_id": other_id,
        "admin_email": "admin@org-a.com",
        "member_email": "member@org-a.com",
        "other_email": "admin@org-b.com"
    }

import time

def get_headers(user_id: uuid.UUID, email: str, org_id: uuid.UUID) -> dict:
    payload = {
        "sub": str(user_id),
        "email": email,
        "aud": "authenticated",
        "exp": int(time.time()) + 3600
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    return {
        "Authorization": f"Bearer {token}",
        "X-Workspace-Id": str(org_id)
    }

def test_admin_authorization(seeded_data):
    client = TestClient(app)
    admin_h = get_headers(seeded_data["admin_id"], seeded_data["admin_email"], seeded_data["org_a_id"])
    member_h = get_headers(seeded_data["member_id"], seeded_data["member_email"], seeded_data["org_a_id"])
    
    # 1. Admin accessing observability GET /costs -> OK
    resp = client.get("/api/observability/costs", headers=admin_h)
    assert resp.status_code == status.HTTP_200_OK
    
    # 2. Member accessing observability GET /costs -> 403 Forbidden
    resp = client.get("/api/observability/costs", headers=member_h)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    
    # 3. Admin accessing product analytics -> OK
    resp = client.get("/api/analytics/products", headers=admin_h)
    assert resp.status_code == status.HTTP_200_OK
    
    # 4. Member accessing product analytics -> 403 Forbidden
    resp = client.get("/api/analytics/products", headers=member_h)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

def test_tenant_isolation_idor(seeded_data):
    client = TestClient(app)
    
    # Admin A attempts to access Org B using Org B's ID in header
    tampered_h = get_headers(seeded_data["admin_id"], seeded_data["admin_email"], seeded_data["org_b_id"])
    
    # Should block with 403 Forbidden (not a member of Org B)
    resp = client.get("/api/observability/costs", headers=tampered_h)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

def test_jwt_validation_failure(seeded_data):
    client = TestClient(app)
    
    # Tampered signature
    payload = {
        "sub": str(seeded_data["admin_id"]),
        "email": seeded_data["admin_email"],
        "aud": "authenticated"
    }
    bad_token = jwt.encode(payload, "wrong_jwt_secret_value", algorithm="HS256")
    headers = {
        "Authorization": f"Bearer {bad_token}",
        "X-Workspace-Id": str(seeded_data["org_a_id"])
    }
    
    resp = client.get("/api/observability/costs", headers=headers)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

def test_rate_limiting_trigger(seeded_data):
    import sys
    original_env = settings.ENV
    original_environment = settings.ENVIRONMENT
    settings.ENV = "production"
    settings.ENVIRONMENT = "production"
    
    original_pytest = sys.modules.get("pytest")
    if "pytest" in sys.modules:
        del sys.modules["pytest"]
        
    try:
        client = TestClient(app)
        headers = get_headers(seeded_data["admin_id"], seeded_data["admin_email"], seeded_data["org_a_id"])
        
        # Override Gemini service to return instant mock
        gemini_service = container.get("gemini_service")
        original_generate = gemini_service.generate_structured_response
        original_mock = gemini_service.mock_mode

        async def mock_generate_structured_response(*args, **kwargs):
            return {
                "intent": "general_greeting",
                "parameters": {},
                "response": "Hello!",
                "confidence_score": 0.95,
                "confidence_category": "HIGH"
            }

        gemini_service.generate_structured_response = mock_generate_structured_response
        gemini_service.mock_mode = False
        
        try:
            # Rate limit is 15 requests/min. 16th request should trigger 429
            for i in range(15):
                resp = client.post("/api/executive/chat", json={"question": "hi"}, headers=headers)
                assert resp.status_code == status.HTTP_200_OK
                
            resp = client.post("/api/executive/chat", json={"question": "hi"}, headers=headers)
            assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        finally:
            gemini_service.generate_structured_response = original_generate
            gemini_service.mock_mode = original_mock
    finally:
        settings.ENV = original_env
        settings.ENVIRONMENT = original_environment
        if original_pytest:
            sys.modules["pytest"] = original_pytest

def test_product_analytics_logic(seeded_data):
    client = TestClient(app)
    headers = get_headers(seeded_data["admin_id"], seeded_data["admin_email"], seeded_data["org_a_id"])
    
    resp = client.get("/api/analytics/products", headers=headers)
    assert resp.status_code == status.HTTP_200_OK
    
    data = resp.json()
    
    # Assert dead stock is correct
    dead_stock = data.get("dead_stock", [])
    assert len(dead_stock) == 1
    assert dead_stock[0]["sku"] == "SKU-DEAD-STOCK"
    
    # Assert category breakdown has data
    category_breakdown = data.get("category_breakdown", [])
    assert len(category_breakdown) > 0
    
    # Assert low margin alerts are triggered
    low_margin = data.get("low_margin_alerts", [])
    assert len(low_margin) == 1
    assert low_margin[0]["sku"] == "SKU-TEST-ANALYTICS"
    assert low_margin[0]["margin_percent"] < 15.0
