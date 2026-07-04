# ==============================================================================
# PURPOSE: Comprehensive Tenant Isolation Integration Test Suite.
# DATA FLOW: Authenticates User A / Organization A -> Attempts to query, modify,
#            or delete Organization B resources -> Asserts 403 or 404 responses.
# ==============================================================================

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
from app.models.project import Project
from app.models.client import Client
from app.models.product import Product
from app.models.inventory import InventoryItem
from app.models.document import ProcessedDocument
from app.core.security import get_current_user

# 1. Setup SQLite in-memory DB for isolated tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# 2. Seed Test Tenants, Users, and Resources
USER_A_ID = uuid.uuid4()
USER_B_ID = uuid.uuid4()
ORG_A_ID = uuid.uuid4()
ORG_B_ID = uuid.uuid4()

CLIENT_B_ID = uuid.uuid4()
PROJECT_B_ID = uuid.uuid4()
PRODUCT_B_ID = uuid.uuid4()
INVENTORY_B_ID = uuid.uuid4()
DOCUMENT_B_ID = uuid.uuid4()

db = TestingSessionLocal()

# Seed Profiles
user_a = Profile(id=USER_A_ID, email="user_a@example.com", full_name="User A", hashed_password="pw")
user_b = Profile(id=USER_B_ID, email="user_b@example.com", full_name="User B", hashed_password="pw")
db.add(user_a)
db.add(user_b)

# Seed Orgs
org_a = Organization(id=ORG_A_ID, name="Org A", slug="org-a")
org_b = Organization(id=ORG_B_ID, name="Org B", slug="org-b")
db.add(org_a)
db.add(org_b)

# Seed Memberships
membership_a = Membership(user_id=USER_A_ID, organization_id=ORG_A_ID, role="admin")
membership_b = Membership(user_id=USER_B_ID, organization_id=ORG_B_ID, role="admin")
db.add(membership_a)
db.add(membership_b)

# Seed Client for Org B
client_b = Client(
    id=CLIENT_B_ID,
    organization_id=ORG_B_ID,
    company_name="Corp B",
    contact_person="Client B",
    email="client_b@example.com",
    status="active"
)
db.add(client_b)

# Seed Product for Org B
product_b = Product(
    id=PRODUCT_B_ID,
    organization_id=ORG_B_ID,
    sku="SKU-B",
    name="Product B",
    category="Tops",
    unit_cost=10.0,
    selling_price=15.0
)
db.add(product_b)

# Seed Org B specific resources
project_b = Project(
    id=PROJECT_B_ID, 
    organization_id=ORG_B_ID, 
    client_id=CLIENT_B_ID,
    name="Secret Project B", 
    description="Org B private"
)
db.add(project_b)

inventory_b = InventoryItem(
    id=INVENTORY_B_ID, 
    organization_id=ORG_B_ID, 
    product_id=PRODUCT_B_ID,
    stock_on_hand=100, 
    reorder_point=10, 
    lead_time_days=5
)
db.add(inventory_b)

document_b = ProcessedDocument(
    id=DOCUMENT_B_ID,
    organization_id=ORG_B_ID,
    filename="invoice_b.pdf",
    content_type="application/pdf",
    file_size=5000,
    status="completed",
    file_path="uploads/invoice_b.pdf"
)
db.add(document_b)

db.commit()
db.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


active_test_user = None

def mock_get_current_user():
    global active_test_user
    return active_test_user


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


def authenticate_as_user_a():
    global active_test_user
    db_session = TestingSessionLocal()
    active_test_user = db_session.query(Profile).filter(Profile.id == USER_A_ID).first()
    db_session.close()


# --- ISOLATION TESTS FOR MODULES ---

def test_inventory_isolation():
    """
    Asserts User A cannot read, modify, or delete Organization B inventory items.
    """
    authenticate_as_user_a()
    headers = {"X-Workspace-Id": str(ORG_A_ID)}

    # 1. Attempt to GET Tenant B's inventory item
    response = client.get(f"/api/inventory/{INVENTORY_B_ID}", headers=headers)
    assert response.status_code in [403, 404]

    # 2. Attempt to PUT Tenant B's inventory item
    response = client.put(
        f"/api/inventory/{INVENTORY_B_ID}", 
        json={"stock_on_hand": 999}, 
        headers=headers
    )
    assert response.status_code in [403, 404]

    # 3. Attempt to DELETE Tenant B's inventory item
    response = client.delete(f"/api/inventory/{INVENTORY_B_ID}", headers=headers)
    assert response.status_code in [403, 404]


def test_project_isolation():
    """
    Asserts User A cannot read, modify, or delete Organization B projects.
    """
    authenticate_as_user_a()
    headers = {"X-Workspace-Id": str(ORG_A_ID)}

    # 1. Attempt to GET Tenant B's project
    response = client.get(f"/api/projects/{PROJECT_B_ID}", headers=headers)
    assert response.status_code in [403, 404]

    # 2. Attempt to PUT Tenant B's project
    response = client.put(f"/api/projects/{PROJECT_B_ID}", json={"name": "Tampered Project"}, headers=headers)
    assert response.status_code in [403, 404]

    # 3. Attempt to DELETE Tenant B's project
    response = client.delete(f"/api/projects/{PROJECT_B_ID}", headers=headers)
    assert response.status_code in [403, 404]


def test_document_isolation():
    """
    Asserts User A cannot access or delete Organization B document intelligence records.
    """
    authenticate_as_user_a()
    headers = {"X-Workspace-Id": str(ORG_A_ID)}

    # 1. Attempt to GET Tenant B's document details
    response = client.get(f"/api/documents/{DOCUMENT_B_ID}", headers=headers)
    assert response.status_code in [403, 404]

    # 2. Attempt to GET Tenant B's document preview
    response = client.get(f"/api/documents/{DOCUMENT_B_ID}/preview", headers=headers)
    assert response.status_code in [403, 404]

    # 3. Attempt to DELETE Tenant B's document
    response = client.delete(f"/api/documents/{DOCUMENT_B_ID}", headers=headers)
    assert response.status_code in [403, 404]


def test_cross_tenant_header_bypass_rejection():
    """
    Asserts User A cannot bypass boundaries by manually providing Organization B in headers.
    """
    authenticate_as_user_a()
    headers = {"X-Workspace-Id": str(ORG_B_ID)}

    # Attempt to query projects using the forged header
    response = client.get("/api/projects", headers=headers)
    assert response.status_code == 403
    assert "Not a member of this workspace" in response.json()["detail"]
