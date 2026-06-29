# ==============================================================================
# PURPOSE: Integration tests for the FastAPI RBAC role validation system.
# DATA FLOW: Creates test organization, user profiles with Owner/Admin/Manager/Employee
#            memberships, and calls routes to assert role-access limits.
# ==============================================================================

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi import Depends

from app.main import app
from app.database import Base, get_db
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.models.client import Client
from app.models.project import Project
from app.models.product import Product
from app.models.inventory import InventoryItem
from app.models.document import ProcessedDocument
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

# Active test user ID context populated dynamically during tests
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
def setup_rbac_overrides():
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
def setup_rbac_data():
    """
    Seeds a test organization and four users representing Owner, Admin, Manager, and Employee.
    """
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    
    # Create Tenant Organization
    org = Organization(id=org_id, name="RBAC Test Corp", slug="rbac-test")
    db.add(org)
    
    # Create Profiles
    roles = ["owner", "admin", "manager", "employee"]
    users = {}
    for r in roles:
        user_id = uuid.uuid4()
        profile = Profile(
            id=user_id,
            email=f"{r}@rbac.com",
            full_name=f"{r.capitalize()} User",
            hashed_password="hashed_password"
        )
        db.add(profile)
        
        # Link role membership
        mem = Membership(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user_id,
            role=r
        )
        db.add(mem)
        
        users[r] = {
            "id": user_id,
            "email": f"{r}@rbac.com"
        }

    # Add a Client for project linking (Project requires NOT NULL client_id)
    client_id = uuid.uuid4()
    client = Client(id=client_id, organization_id=org_id, company_name="RBAC Client")
    db.add(client)

    # Add a Project
    proj_id = uuid.uuid4()
    project = Project(id=proj_id, organization_id=org_id, client_id=client_id, name="RBAC Proj")
    db.add(project)

    # Add a Product and Inventory item
    prod_id = uuid.uuid4()
    product = Product(id=prod_id, organization_id=org_id, sku="RBAC-SKU", name="RBAC Prod", category="Tops", unit_cost=10, selling_price=20)
    db.add(product)
    db.flush()

    inv_id = uuid.uuid4()
    inv_item = InventoryItem(id=inv_id, organization_id=org_id, product_id=prod_id, stock_on_hand=50, reorder_point=10)
    db.add(inv_item)

    # Add a Document
    doc_id = uuid.uuid4()
    doc = ProcessedDocument(
        id=doc_id,
        organization_id=org_id,
        filename="rbac_doc.pdf",
        status="success",
        document_type="invoice",
        content_type="application/pdf",
        file_size=1024,
        file_path="uploads/rbac_doc.pdf"
    )
    db.add(doc)

    db.commit()
    db.close()
    
    return {
        "org_id": org_id,
        "users": users,
        "proj_id": proj_id,
        "sku": "RBAC-SKU",
        "doc_id": doc_id
    }


def test_rbac_endpoint_access(setup_rbac_data):
    """
    Validates role-based execution constraints across all modules.
    """
    global active_test_user_id
    org_id = str(setup_rbac_data["org_id"])
    users = setup_rbac_data["users"]
    proj_id = str(setup_rbac_data["proj_id"])
    sku = setup_rbac_data["sku"]
    doc_id = str(setup_rbac_data["doc_id"])

    client = TestClient(app)

    # 1. FINANCE TESTING (Read/Write: Manager+)
    # Employee should be rejected (403)
    active_test_user_id = users['employee']['id']
    resp = client.get("/api/finance/revenue", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 403

    # Manager should be accepted (200)
    active_test_user_id = users['manager']['id']
    resp = client.get("/api/finance/revenue", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 200

    # 2. INVENTORY TESTING (Edit: Manager+, Delete: Admin+)
    # Employee cannot edit stock (403)
    active_test_user_id = users['employee']['id']
    resp = client.put(f"/api/inventory/product/{sku}/stock", json={"stock_on_hand": 99}, headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 403

    # Manager can edit stock (200)
    active_test_user_id = users['manager']['id']
    resp = client.put(f"/api/inventory/product/{sku}/stock", json={"stock_on_hand": 99}, headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 200

    # 3. DOCUMENTS TESTING (Upload: Manager+, Delete: Admin+)
    # Employee cannot delete document (403)
    active_test_user_id = users['employee']['id']
    resp = client.delete(f"/api/documents/{doc_id}", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 403

    # Manager cannot delete document (403)
    active_test_user_id = users['manager']['id']
    resp = client.delete(f"/api/documents/{doc_id}", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 403

    # Admin CAN delete document (200 / deletion success)
    active_test_user_id = users['admin']['id']
    resp = client.delete(f"/api/documents/{doc_id}", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 200

    # 4. PROJECTS TESTING (Create/Edit: Employee+, Delete: Manager+)
    # Employee cannot delete project (403)
    active_test_user_id = users['employee']['id']
    resp = client.delete(f"/api/projects/{proj_id}", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 403

    # Manager CAN delete project (204)
    active_test_user_id = users['manager']['id']
    resp = client.delete(f"/api/projects/{proj_id}", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 204

    # 5. USER MANAGEMENT TESTING (Admin+ invite/remove, Admin cannot delete Owner)
    # Manager cannot invite (403)
    active_test_user_id = users['manager']['id']
    resp = client.post("/api/organization/invite", json={"email": "new_guy@rbac.com", "role": "employee"}, headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 403

    # Admin CAN invite (201)
    active_test_user_id = users['admin']['id']
    resp = client.post("/api/organization/invite", json={"email": "new_guy@rbac.com", "role": "employee"}, headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 201

    # Admin cannot remove Owner (403)
    active_test_user_id = users['admin']['id']
    owner_id = str(users['owner']['id'])
    resp = client.delete(f"/api/organization/members/{owner_id}", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 403

    # Owner CAN remove Admin (200)
    active_test_user_id = users['owner']['id']
    admin_id = str(users['admin']['id'])
    resp = client.delete(f"/api/organization/members/{admin_id}", headers={"X-Workspace-Id": org_id})
    assert resp.status_code == 200
