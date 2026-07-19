import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.profile import Profile
from app.models.waitlist import WaitlistEntry

client = TestClient(app)


@pytest.fixture
def db_session():
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_waitlist_overrides(db_session):
    from app.database import get_db
    old_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(old_overrides)


def test_profile_trial_defaults(db_session: Session):
    """
    Test that creating a new Profile automatically populates
    trial dates, subscription status, and plan type.
    """
    unique_email = f"trial-tester-{uuid.uuid4()}@example.com"
    profile = Profile(
        id=uuid.uuid4(),
        email=unique_email,
        hashed_password="hashedpassword123",
        full_name="Trial User"
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)

    try:
        assert profile.subscription_status == "trial"
        assert profile.plan_type == "starter"
        assert profile.trial_start_date is not None
        assert profile.trial_end_date is not None
        
        # Verify 14-day duration
        duration = profile.trial_end_date - profile.trial_start_date
        assert abs(duration.days - 14) <= 1
    finally:
        db_session.delete(profile)
        db_session.commit()


def test_waitlist_anonymous_join(db_session: Session):
    """
    Test joining the waitlist anonymously.
    """
    test_email = f"lead-{uuid.uuid4()}@company.com"
    payload = {
        "name": "Anonymous Lead",
        "email": test_email,
        "company_name": "Acme Fashion",
        "company_website": "acmefashion.com",
        "revenue_range": "100k_500k",
        "biggest_inventory_challenge": "High supply chain lead times."
    }

    response = client.post("/api/waitlist", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"

    # Verify database entry
    db_session.commit()
    entry = db_session.query(WaitlistEntry).filter(WaitlistEntry.email == test_email).first()
    try:
        assert entry is not None
        assert entry.name == "Anonymous Lead"
        assert entry.company_name == "Acme Fashion"
        assert entry.revenue_range == "100k_500k"
        assert entry.biggest_inventory_challenge == "High supply chain lead times."
    finally:
        if entry:
            db_session.delete(entry)
            db_session.commit()


def test_waitlist_duplicate_prevention(db_session: Session):
    """
    Test that duplicate waitlist signups for the same email are rejected.
    """
    test_email = f"duplicate-{uuid.uuid4()}@company.com"
    payload = {
        "name": "Duplicate Tester",
        "email": test_email,
        "company_name": "Double Inc"
    }

    # First signup
    response1 = client.post("/api/waitlist", json=payload)
    assert response1.status_code == 200
    assert response1.json()["status"] == "success"

    # Second signup
    response2 = client.post("/api/waitlist", json=payload)
    assert response2.status_code == 200
    assert response2.json()["status"] == "already_registered"

    # Clean up
    db_session.commit()
    entry = db_session.query(WaitlistEntry).filter(WaitlistEntry.email == test_email).first()
    if entry:
        db_session.delete(entry)
        db_session.commit()


def test_admin_stats_requires_authorization(db_session: Session):
    """
    Admin waitlist analytics must not be publicly readable.
    """
    response = client.get("/api/waitlist/admin-stats")
    assert response.status_code == 401
