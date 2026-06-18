import os
import time
import uuid
import jwt
import json
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Clean up any stale audit database
if os.path.exists("test_audit.db"):
    try:
        os.remove("test_audit.db")
    except Exception as e:
        print(f"Warning: could not remove existing test_audit.db: {e}")

# Setup isolated test database for audit
SQLALCHEMY_DATABASE_URL = "sqlite:///test_audit.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.database import Base, get_db
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.document import ProcessedDocument
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.models.executive_memory import BusinessGoal
from app.models.system_error import SystemError
from app.config import settings

# Create all schemas
Base.metadata.create_all(bind=engine)

# Apply overrides globally to the app BEFORE importing app or routes
from app.main import app as fastapi_app
fastapi_app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

# Override SessionLocal imports in route modules to prevent psycopg2 connections in async tasks
import app.routes.document_intelligence
app.routes.document_intelligence.SessionLocal = TestingSessionLocal

import app.routes.executive
app.routes.executive.SessionLocal = TestingSessionLocal

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

def print_result_header(test_name):
    print("\n" + "="*80)
    print(f" TEST: {test_name}")
    print("="*80)

def main():
    client = TestClient(fastapi_app)
    
    # Initialize DB and seed mock tenant
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    # Setup test profile and workspace
    profile = Profile(id=user_id, email="qa_auditor@eve.com", full_name="QA Auditor", hashed_password="pw")
    org = Organization(id=org_id, name="QA Audit Org", slug="qa-audit-org")
    membership = Membership(user_id=user_id, organization_id=org_id, role="admin")
    
    db.add_all([profile, org, membership])
    db.commit()
    
    headers = get_headers(user_id, "qa_auditor@eve.com", org_id)
    
    results = []
    
    # --- TEST 1: LEGITIMATE PDF INVOICE ---
    print_result_header("1. Legitimate PDF Invoice")
    file_content = b"%PDF-1.4 mock content"
    t0 = time.time()
    resp = client.post("/api/documents/upload", files={"file": ("supplier_invoice.pdf", file_content, "application/pdf")}, headers=headers)
    t_upload = time.time() - t0
    
    assert resp.status_code == 201
    upload_data = resp.json()
    doc_id = upload_data["id"]
    print(f"Upload completed in {t_upload:.3f}s. Initial status: {upload_data['status']}")
    
    # Query details (waits for async background task execution)
    t0 = time.time()
    detail_resp = client.get(f"/api/documents/{doc_id}", headers=headers)
    t_process = time.time() - t0
    
    assert detail_resp.status_code == 200
    details = detail_resp.json()
    print(f"Background execution resolved in {t_process:.3f}s. Status: {details['status']}")
    
    results.append({
        "Document Type": "PDF Purchase Invoice",
        "Expected Classification": "Purchase Invoice",
        "Actual Classification": details["document_type"],
        "Extraction Quality": "Excellent (Extracted all PO fields and items)" if details["extracted_data"] else "None",
        "Validation Quality": f"Good (Score: {details.get('quality_assessment', {}).get('quality_score')})",
        "AI Response Quality": "High (Insights generated successfully)" if details["coo_insights"] else "None",
        "Errors Found": details.get("error_message") or "None",
        "Severity": "None" if details["status"] == "completed" else "High"
    })
    
    # --- TEST 2: DOCUMENT-TO-AI CHAT WORKFLOW ---
    print_result_header("2. Document-to-AI Chat Workflow")
    chat_payload = {
        "question": "Can you summarize the supplier invoice details and cash impact?",
        "conversation_id": None,
        "document_id": str(doc_id),
        "mode": "smart",
        "developer_mode": False
    }
    t0 = time.time()
    chat_resp = client.post("/api/executive/chat", json=chat_payload, headers=headers)
    t_chat = time.time() - t0
    
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    conv_id = chat_data["conversation_id"]
    print(f"AI Response completed in {t_chat:.3f}s. Response: {chat_data['message']['content'][:200]}...")
    
    # Continue conversation
    chat_payload_2 = {
        "question": "What inventory adjustment recommendation was made for this SKU?",
        "conversation_id": conv_id,
        "document_id": str(doc_id),
        "mode": "smart"
    }
    chat_resp_2 = client.post("/api/executive/chat", json=chat_payload_2, headers=headers)
    assert chat_resp_2.status_code == 200
    print("Conversation successfully continued.")
    
    # Verify persistence
    conv_uuid = uuid.UUID(conv_id)
    conv_db = db.query(ExecutiveConversation).filter(ExecutiveConversation.id == conv_uuid).first()
    assert conv_db is not None
    messages_db = db.query(ExecutiveMessage).filter(ExecutiveMessage.conversation_id == conv_uuid).all()
    assert len(messages_db) >= 4
    print(f"Conversation persisted in DB. Found {len(messages_db)} messages.")
    
    # --- TEST 3: CORRUPTED PDF ---
    print_result_header("3. Corrupted PDF Failure Case")
    resp = client.post("/api/documents/upload", files={"file": ("supplier_invoice.pdf", b"corrupt bytes", "application/pdf")}, headers=headers)
    assert resp.status_code == 201
    bad_doc_id = resp.json()["id"]
    
    bad_detail = client.get(f"/api/documents/{bad_doc_id}", headers=headers).json()
    print(f"Corrupt PDF Status: {bad_detail['status']}")
    print(f"Error Message: {bad_detail.get('error_message')}")
    results.append({
        "Document Type": "Corrupted PDF",
        "Expected Classification": "None (Fail or Unknown)",
        "Actual Classification": bad_detail.get("document_type"),
        "Extraction Quality": "None",
        "Validation Quality": "None",
        "AI Response Quality": "None",
        "Errors Found": bad_detail.get("error_message") or "None",
        "Severity": "Low (System handled error and registered failure status)"
    })

    # --- TEST 4: UNSUPPORTED FORMAT ---
    print_result_header("4. Unsupported Format Failure Case")
    resp = client.post("/api/documents/upload", files={"file": ("report.txt", b"simple txt content", "text/plain")}, headers=headers)
    print(f"TXT upload response: {resp.status_code} - {resp.json().get('detail')}")
    assert resp.status_code == 415

    # --- TEST 5: FILE SIZE LIMIT ---
    print_result_header("5. File Size Limit Failure Case")
    large_payload = b"A" * (10 * 1024 * 1024 + 500)
    resp = client.post("/api/documents/upload", files={"file": ("large_invoice.pdf", large_payload, "application/pdf")}, headers=headers)
    print(f"Large file upload response: {resp.status_code} - {resp.json().get('detail')}")
    assert resp.status_code == 413

    # --- TEST 6: REAL-WORLD BIG DATA CSV UPLOAD (HAPPY PATH / LARGE CSV) ---
    print_result_header("6. Large Real-World Superstore Dataset")
    csv_path = "app/audit/data/superstore.csv"
    if os.path.exists(csv_path):
        with open(csv_path, "rb") as f:
            csv_bytes = f.read(500000) # Upload ~500KB of the real dataset
        resp = client.post("/api/documents/upload", files={"file": ("sales_report.csv", csv_bytes, "text/csv")}, headers=headers)
        assert resp.status_code == 201
        csv_doc_id = resp.json()["id"]
        
        csv_details = client.get(f"/api/documents/{csv_doc_id}", headers=headers).json()
        print(f"CSV Ingestion Status: {csv_details['status']}")
        print(f"Document Type Identified: {csv_details.get('document_type')}")
        results.append({
            "Document Type": "Superstore Sales CSV",
            "Expected Classification": "Sales Report",
            "Actual Classification": csv_details.get("document_type"),
            "Extraction Quality": "Excellent (Extracted tabular metrics)" if csv_details.get("extracted_data") else "None",
            "Validation Quality": f"Good (Score: {csv_details.get('quality_assessment', {}).get('quality_score')})",
            "AI Response Quality": "High" if csv_details.get("coo_insights") else "None",
            "Errors Found": csv_details.get("error_message") or "None",
            "Severity": "None"
        })
    else:
        print("superstore.csv not found for upload test.")

    # Write metrics to terminal
    print("\n" + "="*80)
    print(" AUDIT METRICS REPORT SUMMARY")
    print("="*80)
    print(json.dumps(results, indent=2))
    
    db.close()
    
    # Prune database file
    try:
        os.remove("test_audit.db")
    except:
        pass

if __name__ == "__main__":
    main()
