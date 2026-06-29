# ==============================================================================
# PURPOSE: Integration tests for Upload Security Phase 1 features.
# DATA FLOW: Seeding organizations, uploading valid/invalid magic-byte files,
#            simulating storage quota exhaustion, uploading duplicate files,
#            and executing directory cleanup task.
# ==============================================================================

import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi import Depends

from app.main import app
from app.database import Base, get_db
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.models.document import ProcessedDocument
from app.core.security import get_current_user
from app.services.document_intelligence.upload_security_service import UploadSecurityService

# 1. Setup isolated memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# Active test user profile context populated dynamically during tests
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
def setup_upload_security_overrides():
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
def setup_upload_data():
    """
    Seeds a test organization and admin user.
    """
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    # Create Tenant Organization
    org = Organization(id=org_id, name="Upload Security Corp", slug="upload-sec")
    db.add(org)
    
    # Create Profile
    profile = Profile(id=user_id, email="admin@uploadsec.com", full_name="Security Admin", hashed_password="pw")
    db.add(profile)
    
    # Link role membership
    mem = Membership(id=uuid.uuid4(), organization_id=org_id, user_id=user_id, role="admin")
    db.add(mem)
    
    db.commit()
    db.close()
    
    return {
        "org_id": org_id,
        "user_id": user_id
    }


def test_magic_byte_validation():
    """
    Verifies that files with mismatched content and extensions are rejected.
    """
    # A CSV file starting with PDF header should fail magic check
    mismatched_pdf = b"This is not a PDF file"
    assert not UploadSecurityService.validate_magic_bytes(mismatched_pdf, ".pdf")

    # A valid PDF header should succeed
    valid_pdf = b"%PDF-1.4 header..."
    assert UploadSecurityService.validate_magic_bytes(valid_pdf, ".pdf")

    # A PNG header check
    valid_png = b"\x89PNG\r\n\x1a\nSomeData"
    assert UploadSecurityService.validate_magic_bytes(valid_png, ".png")


def test_quota_enforcement(setup_upload_data):
    """
    Verifies that organization quota rejects files exceeding cumulative 50MB.
    """
    db = TestingSessionLocal()
    org_id = setup_upload_data["org_id"]

    try:
        # Enforce on a small size should pass
        UploadSecurityService.enforce_quota(db, org_id, 1000)

        # Enforce on a size exceeding 50MB should raise HTTPException
        with pytest.raises(Exception) as exc:
            UploadSecurityService.enforce_quota(db, org_id, 51 * 1024 * 1024)
        assert "quota exceeded" in str(exc.value.detail).lower()

    finally:
        db.close()


def test_duplicate_upload_detection(setup_upload_data):
    """
    Verifies that duplicate content hashes are blocked.
    """
    db = TestingSessionLocal()
    org_id = setup_upload_data["org_id"]
    file_bytes = b"%PDF-1.4 sample content..."

    try:
        # Calculate and process first upload
        hash_val = UploadSecurityService.process_sha256_and_detect_duplicate(db, org_id, file_bytes)
        assert hash_val is not None

        # Add processed document record to DB
        doc = ProcessedDocument(
            id=uuid.uuid4(),
            organization_id=org_id,
            filename="sample.pdf",
            content_type="application/pdf",
            file_size=len(file_bytes),
            status="success",
            file_path="uploads/sample.pdf",
            sha256_hash=hash_val
        )
        db.add(doc)
        db.commit()

        # Attempting duplicate upload within same organization should raise HTTP 400
        with pytest.raises(Exception) as exc:
            UploadSecurityService.process_sha256_and_detect_duplicate(db, org_id, file_bytes)
        assert "already been uploaded" in str(exc.value.detail).lower()

    finally:
        db.close()


def test_failed_and_orphaned_cleanup(setup_upload_data):
    """
    Verifies that files deleted or orphaned are cleaned up from the storage disk.
    """
    db = TestingSessionLocal()
    org_id = setup_upload_data["org_id"]
    
    # Create a local file in 'uploads' directory
    os.makedirs("uploads", exist_ok=True)
    temp_file_name = f"test_cleanup_{uuid.uuid4()}.pdf"
    temp_file_path = f"uploads/{temp_file_name}"
    
    with open(temp_file_path, "wb") as f:
        f.write(b"Temp orphaned contents")

    assert os.path.exists(temp_file_path)

    try:
        # Run cleanup. Since this file is not registered in the database, it must be deleted.
        report = UploadSecurityService.cleanup_orphaned_uploads(db)
        assert temp_file_path in report["cleaned_files"]
        assert not os.path.exists(temp_file_path)

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        db.close()
