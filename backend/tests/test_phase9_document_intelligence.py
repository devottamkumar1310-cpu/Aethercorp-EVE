import pytest
import uuid
import datetime
import jwt
import io
import time
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app as api_app
from app.database import Base, get_db
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.models.finance import Revenue, Expense
from app.models.audit_log import AuditLog
from app.config import settings

# Setup isolated in-memory database for testing
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

import app.routes.document_intelligence

@pytest.fixture(autouse=True, scope="module")
def manage_dependency_overrides():
    from app.core.security import verify_supabase_token, get_current_user_and_tenant, get_current_user, get_required_workspace_id
    saved_overrides = api_app.dependency_overrides.copy()
    
    for dep in [get_db, get_current_user, get_required_workspace_id, verify_supabase_token, get_current_user_and_tenant]:
        api_app.dependency_overrides.pop(dep, None)
        
    api_app.dependency_overrides[get_db] = override_get_db
    
    # Patch SessionLocal for async background tasks in tests
    old_session_local = app.routes.document_intelligence.SessionLocal
    app.routes.document_intelligence.SessionLocal = TestingSessionLocal
    
    yield
    
    app.routes.document_intelligence.SessionLocal = old_session_local
    api_app.dependency_overrides.clear()
    api_app.dependency_overrides.update(saved_overrides)

@pytest.fixture(scope="module")
def seeded_data():
    db = TestingSessionLocal()
    
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    profile = Profile(id=user_id, email="admin@docintel.com", full_name="DocIntel Admin", hashed_password="pw")
    org = Organization(id=org_id, name="DocIntel Org", slug="docintel-org")
    membership = Membership(user_id=user_id, organization_id=org_id, role="admin")
    
    db.add_all([profile, org, membership])
    db.commit()
    
    # Pre-seed a product for duplicate check test
    prod = Product(
        id=uuid.uuid4(),
        organization_id=org_id,
        sku="TSHIRT-CLASSIC",
        name="Classic Tee",
        category="Apparel",
        unit_cost=10.0,
        selling_price=25.0
    )
    db.add(prod)
    db.flush()
    
    inv = InventoryItem(
        id=uuid.uuid4(),
        organization_id=org_id,
        product_id=prod.id,
        stock_on_hand=50,
        lead_time_days=7
    )
    db.add(inv)
    
    # Pre-seed a duplicate invoice expense record to check duplicate validation logic
    exp_dup = Expense(
        id=uuid.uuid4(),
        organization_id=org_id,
        amount=275.0,
        category="Inventory",
        date=datetime.datetime.utcnow(),
        description="Supplier Invoice INV-DUP-1234 - Mock Supplier Corp"
    )
    db.add(exp_dup)
    db.commit()
    db.close()
    
    return {
        "org_id": org_id,
        "user_id": user_id,
        "email": "admin@docintel.com"
    }

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

def test_document_classification_and_extraction(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # Upload mock Purchase Invoice PDF
    file_payload = {"file": ("supplier_invoice.pdf", b"%PDF-1.4 mock content", "application/pdf")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    
    data = resp.json()
    assert data["status"] == "uploaded"
    doc_id = data["id"]

    # Check status transitions to completed in detail view
    detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert detail_resp.status_code == status.HTTP_200_OK
    detail_data = detail_resp.json()
    assert detail_data["status"] == "completed"
    assert detail_data["document_type"] == "Purchase Invoice"
    assert "extracted_data" in detail_data
    assert detail_data["extracted_data"]["invoice_number"] == "INV-2026-0001"
    assert detail_data["coo_insights"] != ""

    # Verify inventory was updated
    db = TestingSessionLocal()
    inv_item = db.query(InventoryItem).join(Product).filter(
        Product.organization_id == seeded_data["org_id"],
        Product.sku == "TSHIRT-CLASSIC"
    ).first()
    # Initial stock 50 + 10 from invoice = 60
    assert inv_item.stock_on_hand == 60
    
    # Verify expense was logged
    expense = db.query(Expense).filter(
        Expense.organization_id == seeded_data["org_id"],
        Expense.description.like("%INV-2026-0001%")
    ).first()
    assert expense is not None
    assert expense.amount == 275.0
    db.close()

def test_purchase_order_ingestion(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # Upload mock Purchase Order PO image
    file_payload = {"file": ("purchase_order.png", b"mock png content", "image/png")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    
    data = resp.json()
    assert data["status"] == "uploaded"
    doc_id = data["id"]

    # Check details for success
    detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert detail_resp.status_code == status.HTTP_200_OK
    detail_data = detail_resp.json()
    assert detail_data["status"] == "completed"
    assert detail_data["document_type"] == "Purchase Order"
    assert detail_data["extracted_data"]["po_number"] == "PO-2026-8899"
    
    # Verify PO inventory updates
    db = TestingSessionLocal()
    inv_item = db.query(InventoryItem).join(Product).filter(
        Product.organization_id == seeded_data["org_id"],
        Product.sku == "FABRIC-COTTON-01"
    ).first()
    assert inv_item is not None
    assert inv_item.stock_on_hand == 150 # Seeded from PO mock
    db.close()

def test_expense_receipt_ingestion(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # Upload mock Receipt image
    file_payload = {"file": ("rent_receipt.jpg", b"mock rent content", "image/jpeg")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    
    data = resp.json()
    assert data["status"] == "uploaded"
    doc_id = data["id"]

    # Check details for success
    detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert detail_resp.status_code == status.HTTP_200_OK
    detail_data = detail_resp.json()
    assert detail_data["status"] == "completed"
    assert detail_data["document_type"] == "Receipt"
    
    # Verify expense record added to DB
    db = TestingSessionLocal()
    expense = db.query(Expense).filter(
        Expense.organization_id == seeded_data["org_id"],
        Expense.category == "Rent"
    ).first()
    assert expense is not None
    assert expense.amount == 1250.0
    db.close()

def test_validation_duplicate_invoice(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # Upload mock duplicate Invoice PDF
    file_payload = {"file": ("invoice_duplicate.pdf", b"%PDF-1.4 mock content", "application/pdf")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    
    doc_id = resp.json()["id"]
    detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    detail_data = detail_resp.json()
    assert detail_data["status"] == "failure"
    assert "validation issues detected" in detail_data["error_message"].lower()

def test_validation_negative_value(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # Upload mock negative values invoice PDF
    file_payload = {"file": ("invoice_negative.pdf", b"%PDF-1.4 mock content", "application/pdf")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    
    doc_id = resp.json()["id"]
    detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    detail_data = detail_resp.json()
    assert detail_data["status"] == "failure"

def test_invalid_file_types(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # Upload txt file (unsupported format)
    file_payload = {"file": ("report.txt", b"txt mock content", "text/plain")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE

def test_file_size_limit(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # Generate large payload exceeding 10MB limit
    large_payload = b"A" * (10 * 1024 * 1024 + 100)
    file_payload = {"file": ("supplier_invoice.pdf", large_payload, "application/pdf")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
