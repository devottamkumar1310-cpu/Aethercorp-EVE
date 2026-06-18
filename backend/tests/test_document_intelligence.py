import pytest
import uuid
import datetime
import jwt
import io
import os
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app as api_app
from app.database import Base, get_db
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.document import ProcessedDocument
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
    
    profile = Profile(id=user_id, email="user@docintel.com", full_name="DocIntel User", hashed_password="pw")
    org = Organization(id=org_id, name="Test Doc Org", slug="test-doc-org")
    membership = Membership(user_id=user_id, organization_id=org_id, role="member")
    
    db.add_all([profile, org, membership])
    db.commit()
    db.close()
    
    return {
        "org_id": org_id,
        "user_id": user_id,
        "email": "user@docintel.com"
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

def test_document_lifecycle(seeded_data):
    client = TestClient(api_app)
    headers = get_headers(seeded_data["user_id"], seeded_data["email"], seeded_data["org_id"])
    
    # 1. Upload Document
    file_content = b"%PDF-1.4 mock content"
    file_payload = {"file": ("supplier_invoice.pdf", file_content, "application/pdf")}
    resp = client.post("/api/documents/upload", files=file_payload, headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    
    data = resp.json()
    assert data["status"] == "uploaded"
    assert data["filename"] == "supplier_invoice.pdf"
    doc_id = data["id"]
    
    # Wait for background task to complete (it runs synchronously within the TestClient cycle)
    # 2. List Documents
    list_resp = client.get("/api/documents", headers=headers)
    assert list_resp.status_code == status.HTTP_200_OK
    docs_list = list_resp.json()
    assert len(docs_list) > 0
    
    uploaded_doc = next(d for d in docs_list if d["id"] == doc_id)
    assert uploaded_doc["status"] in ["uploaded", "processing", "classified", "validated", "completed"]
    
    # 3. Get Document Details
    detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert detail_resp.status_code == status.HTTP_200_OK
    detail_data = detail_resp.json()
    assert detail_data["id"] == doc_id
    assert detail_data["status"] == "completed"
    
    # 4. Preview Document
    preview_resp = client.get(f"/api/documents/{doc_id}/preview", headers=headers)
    assert preview_resp.status_code == status.HTTP_200_OK
    assert preview_resp.content == file_content
    
    # 5. Delete Document
    del_resp = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert del_resp.status_code == status.HTTP_200_OK
    assert del_resp.json()["status"] == "success"
    
    # Confirm deletion
    get_del_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    assert get_del_resp.status_code == status.HTTP_404_NOT_FOUND
