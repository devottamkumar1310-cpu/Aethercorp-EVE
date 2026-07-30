import pytest
import uuid
import threading
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.core.security import get_current_user

# Setup in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ensure models register on Base
Base.metadata.create_all(bind=engine)

# Setup dependency override for get_db
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    db = TestingSessionLocal()
    db.query(Membership).delete()
    db.query(Organization).delete()
    db.query(Profile).delete()
    db.commit()
    db.close()
    yield

def test_first_time_user_provisioning():
    """
    Verifies that a first-time user with no prior profile in the database is automatically provisioned.
    """
    db = TestingSessionLocal()
    new_uuid = uuid.uuid4()
    email = "first_time@example.com"
    
    payload = {
        "sub": str(new_uuid),
        "email": email,
        "user_metadata": {"full_name": "First Time User"}
    }
    
    from app.routes.auth import sync_user
    sync_user(payload=payload, db=db)
    user = db.query(Profile).filter(Profile.id == new_uuid).first()
    assert user is not None
    assert user.id == new_uuid
    assert user.email == email
    assert user.full_name == "First Time User"
    
    # Query database to confirm
    db_user = db.query(Profile).filter(Profile.id == new_uuid).first()
    assert db_user is not None
    db.close()

def test_returning_user_login():
    """
    Verifies that a returning user whose UUID is already matching the Supabase UUID is loaded immediately.
    """
    db = TestingSessionLocal()
    returning_uuid = uuid.uuid4()
    email = "returning@example.com"
    
    # Pre-insert the profile
    profile = Profile(
        id=returning_uuid,
        email=email,
        full_name="Returning User",
        hashed_password="hashed_password",
        is_active=True
    )
    db.add(profile)
    db.commit()
    
    payload = {
        "sub": str(returning_uuid),
        "email": email,
        "user_metadata": {"full_name": "Returning User"}
    }
    
    user = get_current_user(payload=payload, db=db)
    assert user is not None
    assert user.id == returning_uuid
    assert user.email == email
    db.close()

def test_legacy_profile_migration():
    """
    Verifies that a legacy user with an old UUID has their profile purged,
    and a fresh profile is created without automatic restoration of old memberships.
    """
    db = TestingSessionLocal()
    old_uuid = uuid.uuid4()
    new_uuid = uuid.uuid4()
    email = "legacy@example.com"
    
    # Pre-insert old profile and org/membership
    profile = Profile(
        id=old_uuid,
        email=email,
        full_name="Legacy User",
        hashed_password="hashed_password",
        is_active=True
    )
    db.add(profile)
    
    org = Organization(id=uuid.uuid4(), name="Legacy Org", slug="legacy-org")
    db.add(org)
    db.flush()
    
    membership = Membership(user_id=old_uuid, organization_id=org.id, role="owner")
    db.add(membership)
    db.commit()
    
    payload = {
        "sub": str(new_uuid),
        "email": email,
        "user_metadata": {"full_name": "Migrated Legacy User"}
    }
    
    from app.routes.auth import sync_user
    sync_user(payload=payload, db=db)
    user = db.query(Profile).filter(Profile.id == new_uuid).first()
    assert user is not None
    assert user.id == new_uuid
    assert user.email == email
    
    # Assert old profile deleted
    old_profile = db.query(Profile).filter(Profile.id == old_uuid).first()
    assert old_profile is None
    
    # The legacy org's membership must NOT carry over to the new profile — that
    # is what this test exists to prove. Scoped to the legacy org specifically,
    # because sync_user separately self-heals a user with no memberships by
    # provisioning a fresh demo workspace; asserting "no memberships at all"
    # conflated the two and only held while that provisioning was broken under
    # SQLite. See the note in test_user_without_workspace.
    legacy_membership = (
        db.query(Membership)
        .filter(Membership.user_id == new_uuid, Membership.organization_id == org.id)
        .first()
    )
    assert legacy_membership is None, "legacy org access must not survive migration"
    db.close()

def test_concurrent_profile_migrations():
    """
    Verifies that multiple concurrent calls to provision a user profile with the same email resolve cleanly.
    """
    db = TestingSessionLocal()
    old_uuid = uuid.uuid4()
    new_uuid = uuid.uuid4()
    email = "concurrent_legacy@example.com"
    
    # Pre-insert old profile and org/membership
    profile = Profile(
        id=old_uuid,
        email=email,
        full_name="Concurrent Legacy User",
        hashed_password="hashed_password",
        is_active=True
    )
    db.add(profile)
    
    org = Organization(id=uuid.uuid4(), name="Concurrent Org", slug="concurrent-org")
    db.add(org)
    db.flush()
    
    membership = Membership(user_id=old_uuid, organization_id=org.id, role="member")
    db.add(membership)
    db.commit()
    db.close()
    
    barrier = threading.Barrier(2)
    results = []
    
    def run_migration_worker(thread_name):
        local_db = TestingSessionLocal()
        payload = {
            "sub": str(new_uuid),
            "email": email,
            "user_metadata": {"full_name": "Concurrent Legacy User"}
        }
        barrier.wait()
        try:
            from app.routes.auth import sync_user
            sync_user(payload=payload, db=local_db)
            user = local_db.query(Profile).filter(Profile.id == new_uuid).first()
            results.append((thread_name, "SUCCESS", user.id))
        except Exception as e:
            results.append((thread_name, "ERROR", str(e)))
        finally:
            local_db.close()
            
    t1 = threading.Thread(target=run_migration_worker, args=("T1",))
    t2 = threading.Thread(target=run_migration_worker, args=("T2",))
    
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    
    # Verify both succeeded and returned the new UUID
    assert len(results) == 2
    for r in results:
        assert r[1] == "SUCCESS"
        assert r[2] == new_uuid

def test_user_without_workspace():
    """
    Verifies that a user profile loads or is synced successfully even if they have no workspaces.
    """
    db = TestingSessionLocal()
    new_uuid = uuid.uuid4()
    email = "no_workspace@example.com"
    
    payload = {
        "sub": str(new_uuid),
        "email": email,
        "user_metadata": {"full_name": "No Workspace User"}
    }
    
    from app.routes.auth import sync_user
    sync_user(payload=payload, db=db)
    user = get_current_user(payload=payload, db=db)
    assert user is not None
    assert user.id == new_uuid
    
    # sync_user self-heals a user with no workspaces by provisioning the Luma
    # demo (app/routes/auth.py), so a membership is the CORRECT outcome here.
    #
    # This previously asserted None, and passed only because clean_org_data
    # raised on SQLite ("type 'UUID' is not supported") — provisioning failed,
    # sync_user swallowed the error, and no membership was written. The test was
    # pinning a broken code path. Postgres always bound that parameter fine, so
    # production was auto-provisioning correctly the whole time; only the test
    # environment saw the failure.
    membership = db.query(Membership).filter(Membership.user_id == user.id).first()
    assert membership is not None, "sync_user should auto-provision a workspace"
    db.close()
