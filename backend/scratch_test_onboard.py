import asyncio
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.database import Base

# Setup local SQLite test db
engine = create_engine("sqlite:///test_onboard.db")
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Mock user
user_id = uuid.uuid4()
profile = Profile(id=user_id, email="test@test.com", hashed_password="mock")
db.add(profile)
db.commit()

print(f"Profile created: {profile.id}")

# Attempt to onboard
from app.routes.organization import onboard_workspace, OnboardRequest

request = OnboardRequest(name="Test Workspace")

try:
    response = onboard_workspace(request=request, current_user=profile, db=db)
    print("Response:", response)
except Exception as e:
    print("Exception occurred:", type(e).__name__, str(e))
    import traceback
    traceback.print_exc()

db.close()
