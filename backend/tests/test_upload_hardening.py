import pytest
import uuid
import jwt
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

import app.routes.document_intelligence

def override_get_db():
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()

@pytest.fixture(autouse=True, scope="module")
def manage_dependency_overrides():
    saved_overrides = api_app.dependency_overrides.copy()
    api_app.dependency_overrides[get_db] = override_get_db
    
    # Patch SessionLocal for async background tasks
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
    
    profile = Profile(id=user_id, email="auditor@eve.com", full_name="Auditor User", hashed_password="pw")
    org = Organization(id=org_id, name="Audited Corp", slug="audited-corp")
    membership = Membership(user_id=user_id, organization_id=org_id, role="admin")
    
    db.add_all([profile, org, membership])
    db.commit()
    db.close()
    
    return {
        "org_id": org_id,
        "user_id": user_id,
        "email": "auditor@eve.com"
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

def test_invoice_upload_allowed(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    file_content = b"%PDF-1.4 mock content"
    file_payload = {"file": ("supplier_invoice.pdf", file_content, "application/pdf")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert data["status"] == "uploaded"
    assert data["filename"] == "supplier_invoice.pdf"

def test_receipt_upload_allowed(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    file_payload = {"file": ("office_receipt.png", b"\x89PNG\r\n\x1a\nmock png content", "image/png")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert data["status"] == "uploaded"
    assert data["filename"] == "office_receipt.png"

def test_selfie_rejected(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    file_payload = {"file": ("my_selfie.png", b"\x89PNG\r\n\x1a\nmock selfie content", "image/png")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert resp.json()["detail"] == "This file does not appear to be a supported business document."

def test_random_photo_rejected(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    file_payload = {"file": ("vacation_photo.jpg", b"\xff\xd8\xffmock photo content", "image/jpeg")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert resp.json()["detail"] == "This file does not appear to be a supported business document."

def test_meme_rejected(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    file_payload = {"file": ("funny_meme.jpg", b"\xff\xd8\xffmock meme content", "image/jpeg")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert resp.json()["detail"] == "This file does not appear to be a supported business document."
