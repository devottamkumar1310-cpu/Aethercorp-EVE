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
from app.models.client import Client
from app.models.document import ProcessedDocument
from app.services.account_service import AccountService
from app.core.security import get_current_user

# Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

def test_delete_workspace(db_session):
    """
    Test that deleting a workspace deletes the Organization and all associated cascade data.
    """
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    org = Organization(id=org_id, name="Test Org", slug="test-org")
    user = Profile(id=user_id, email="owner@test.com", hashed_password="pw")
    membership = Membership(user_id=user_id, organization_id=org_id, role="owner")
    client = Client(organization_id=org_id, company_name="Test Client", email="c@test.com", status="active")
    
    db_session.add(org)
    db_session.add(user)
    db_session.add(membership)
    db_session.add(client)
    db_session.commit()
    
    # Verify records exist
    assert db_session.query(Organization).filter(Organization.id == org_id).count() == 1
    assert db_session.query(Client).filter(Client.organization_id == org_id).count() == 1
    
    # Execute deletion
    success = AccountService.delete_workspace(db_session, org_id, user)
    assert success is True
    
    # Verify workspace and associated data is cascade deleted
    assert db_session.query(Organization).filter(Organization.id == org_id).count() == 0
    assert db_session.query(Client).filter(Client.organization_id == org_id).count() == 0
    assert db_session.query(Membership).filter(Membership.organization_id == org_id).count() == 0

def test_delete_account(db_session):
    """
    Test that deleting an account purges user profile, solely-owned workspaces, and memberships.
    """
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    
    org = Organization(id=org_id, name="Sole Org", slug="sole-org")
    user = Profile(id=user_id, email="user@test.com", hashed_password="pw")
    membership = Membership(user_id=user_id, organization_id=org_id, role="owner")
    
    db_session.add(org)
    db_session.add(user)
    db_session.add(membership)
    db_session.commit()
    
    # Delete the account
    success = AccountService.delete_account(db_session, user)
    assert success is True
    
    # Profile and solely owned org must be gone
    assert db_session.query(Profile).filter(Profile.id == user_id).count() == 0
    assert db_session.query(Organization).filter(Organization.id == org_id).count() == 0

def test_purge_orphaned_profile(db_session):
    """
    Test that purging an orphaned profile deletes its solely-owned organization and itself.
    """
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    email = "orphan@test.com"
    
    org = Organization(id=org_id, name="Orphan Org", slug="orphan-org")
    user = Profile(id=user_id, email=email, hashed_password="pw")
    membership = Membership(user_id=user_id, organization_id=org_id, role="owner")
    
    db_session.add(org)
    db_session.add(user)
    db_session.add(membership)
    db_session.commit()
    
    # Purge orphaned profile
    AccountService.purge_orphaned_profile(db_session, email)
    db_session.commit()
    
    assert db_session.query(Profile).filter(Profile.email == email).count() == 0
    assert db_session.query(Organization).filter(Organization.id == org_id).count() == 0
