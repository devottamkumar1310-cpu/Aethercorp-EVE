from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user
from app.database import get_db
import uuid
from app.models.profile import Profile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base

engine = create_engine("sqlite:///test_onboard_api.db", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

db_session = TestingSessionLocal()
user_id = uuid.uuid4()
profile = Profile(id=user_id, email="client@test.com", hashed_password="mock")
db_session.add(profile)
db_session.commit()

def override_get_current_user():
    return profile

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

response = client.post("/api/organization/onboard", json={"name": "API Workspace"})
print("Status Code:", response.status_code)
print("Response Text:", response.text)
