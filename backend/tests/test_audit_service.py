# ==============================================================================
# PURPOSE: Integration tests for the AuditService compliance features.
# DATA FLOW: Creates test context -> triggers audit logging -> asserts persistence
#            of user ID, tenant ID, and before/after JSON states.
# ==============================================================================

import pytest
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.organization import Organization
from app.models.profile import Profile
from app.models.audit_log import AuditLog
from app.services.audit_service import AuditService

# 1. Setup isolated memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def test_audit_service_attribution_and_persistence():
    """
    Validates that AuditService logs capture correct user, tenant, client IP,
    and before/after JSON diff states.
    """
    db = TestingSessionLocal()
    
    # Setup test IDs
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    # 1. Create and Seed dependencies
    org = Organization(id=org_id, name="Test Audit Org", slug="audit-org")
    user = Profile(id=user_id, email="audit_tester@example.com", full_name="Auditor", hashed_password="pw")
    db.add(org)
    db.add(user)
    db.commit()

    try:
        # 2. Trigger log_create helper
        create_log = AuditService.log_create(
            db=db,
            user_id=user_id,
            organization_id=org_id,
            event_type="INVENTORY_CREATE",
            after_state={"sku": "SKU-A", "qty": 50},
            client_ip="192.168.1.100",
            message="Created mock inventory row"
        )
        assert create_log is not None
        
        # Query from database to verify persistence
        persisted_log = db.query(AuditLog).filter(AuditLog.id == create_log.id).first()
        assert persisted_log is not None
        assert persisted_log.user_id == user_id
        assert persisted_log.organization_id == org_id
        assert persisted_log.client_ip == "192.168.1.100"
        assert persisted_log.after_state == {"sku": "SKU-A", "qty": 50}
        assert persisted_log.before_state is None

        # 3. Trigger log_update helper
        update_log = AuditService.log_update(
            db=db,
            user_id=user_id,
            organization_id=org_id,
            event_type="INVENTORY_UPDATE",
            before_state={"sku": "SKU-A", "qty": 50},
            after_state={"sku": "SKU-A", "qty": 70},
            client_ip="192.168.1.100",
            message="Updated mock inventory row qty"
        )
        assert update_log is not None
        
        persisted_update = db.query(AuditLog).filter(AuditLog.id == update_log.id).first()
        assert persisted_update is not None
        assert persisted_update.user_id == user_id
        assert persisted_update.organization_id == org_id
        assert persisted_update.before_state == {"sku": "SKU-A", "qty": 50}
        assert persisted_update.after_state == {"sku": "SKU-A", "qty": 70}

        # 4. Trigger log_delete helper
        delete_log = AuditService.log_delete(
            db=db,
            user_id=user_id,
            organization_id=org_id,
            event_type="INVENTORY_DELETE",
            before_state={"sku": "SKU-A", "qty": 70},
            client_ip="192.168.1.100"
        )
        assert delete_log is not None
        
        persisted_delete = db.query(AuditLog).filter(AuditLog.id == delete_log.id).first()
        assert persisted_delete is not None
        assert persisted_delete.user_id == user_id
        assert persisted_delete.organization_id == org_id
        assert persisted_delete.before_state == {"sku": "SKU-A", "qty": 70}
        assert persisted_delete.after_state is None

    finally:
        db.close()
