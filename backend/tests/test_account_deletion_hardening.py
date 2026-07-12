import pytest
import uuid
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.document import ProcessedDocument
from app.models.future import Forecast, Recommendation, Report
from app.models.system_error import SystemError
from app.models.audit_log import AuditLog
from app.models.memory import ConversationSession, ChatMessage, MemoryEntry
from app.models.finance import Expense
from app.models.intelligence_snapshot import IntelligenceSnapshot
from app.models.executive_memory import BusinessGoal
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.models.ai_recommendation import AIRecommendation
from app.services.account_service import AccountService
from app.config import settings

# Setup isolated in-memory SQLite database with foreign keys enabled
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture
def db_session():
    # Use database.py's engine creation approach, but register connect event to enforce foreign keys
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    
    # Register connection listener explicitly to verify foreign key cascade
    from sqlalchemy import event
    
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    
    session = TestingSessionLocal()
    yield session
    session.close()

@patch("httpx.Client")
def test_complete_account_deletion_flow(mock_httpx, db_session):
    # Setup mock httpx client for Supabase admin delete call
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 204
    mock_client.delete.return_value = mock_resp
    mock_httpx.return_value.__enter__.return_value = mock_client

    # Enable mock settings
    settings.SUPABASE_URL = "https://mock-supabase-url.supabase.co"
    settings.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key"

    # 1. Seed user profile & sole-owned organization
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    
    profile = Profile(id=user_id, email="sole_owner@deletion.com", hashed_password="pw")
    org = Organization(id=org_id, name="Sole Workspace", slug="sole-workspace")
    membership = Membership(id=uuid.uuid4(), user_id=user_id, organization_id=org_id, role="owner")
    
    db_session.add_all([profile, org, membership])
    db_session.flush()

    # 2. Seed all child records
    doc = ProcessedDocument(
        id=uuid.uuid4(), organization_id=org_id, filename="tax.pdf", content_type="application/pdf", file_size=123, status="completed"
    )
    forecast = Forecast(
        id=uuid.uuid4(), organization_id=org_id, metrics={"revenue": 50000}
    )
    rec = Recommendation(
        id=uuid.uuid4(), organization_id=org_id, action="Optimize pricing model"
    )
    rep = Report(
        id=uuid.uuid4(), organization_id=org_id, title="Quarterly Operations", content="Good performance."
    )
    sys_err = SystemError(
        id=uuid.uuid4(), organization_id=org_id, component="backend", error_type="TEST_ERROR", message="Failure"
    )
    aud_log = AuditLog(
        id=uuid.uuid4(), organization_id=org_id, event_type="TEST_EVENT", status="SUCCESS", message="Test run success"
    )
    session = ConversationSession(
        id=uuid.uuid4(), organization_id=org_id, title="Test Chat"
    )
    db_session.add_all([doc, forecast, rec, rep, sys_err, aud_log, session])
    db_session.flush()

    # Chat messages require valid session id
    msg = ChatMessage(
        id=uuid.uuid4(), session_id=session.id, role="user", content="Hello EVE"
    )
    memory = MemoryEntry(
        id=uuid.uuid4(), organization_id=org_id, content="User likes apparel focus"
    )
    expense = Expense(
        id=uuid.uuid4(), organization_id=org_id, amount=120.0, category="Logistics"
    )
    snapshot = IntelligenceSnapshot(
        organization_id=org_id, health_score=92.0
    )
    goal = BusinessGoal(
        id=uuid.uuid4(), organization_id=org_id, goal_type="profitability", description="Increase margin"
    )
    exec_conv = ExecutiveConversation(
        id=uuid.uuid4(), organization_id=org_id, title="COO Alignment"
    )
    db_session.add_all([msg, memory, expense, snapshot, goal, exec_conv])
    db_session.flush()

    exec_msg = ExecutiveMessage(
        id=uuid.uuid4(), conversation_id=exec_conv.id, role="user", content="Analyze operations"
    )
    ai_rec = AIRecommendation(
        id=uuid.uuid4(),
        organization_id=org_id,
        agent_source="finance",
        recommendation="Reduce shipping overheads",
        reasoning_summary="Shipping costs are too high",
        data_used={},
        risk_factors=[],
        opportunity_factors=[],
        confidence_level=0.9
    )
    db_session.add_all([exec_msg, ai_rec])
    conversation_session_id = session.id
    executive_conversation_id = exec_conv.id
    db_session.commit()

    # 3. Perform Account Deletion
    success = AccountService.delete_account(db_session, profile)
    assert success is True

    # 4. Verify Supabase Admin User Delete was triggered
    mock_client.delete.assert_called_once_with(
        f"https://mock-supabase-url.supabase.co/auth/v1/admin/users/{user_id}",
        headers={
            "apikey": "mock-service-role-key",
            "Authorization": "Bearer mock-service-role-key"
        }
    )

    # 5. Verify Profile & Organization are deleted
    assert db_session.query(Profile).filter(Profile.id == user_id).first() is None
    assert db_session.query(Organization).filter(Organization.id == org_id).first() is None
    assert db_session.query(Membership).filter(Membership.user_id == user_id).first() is None

    # 6. Verify that ALL child records have been completely purged from DB
    assert db_session.query(ProcessedDocument).filter(ProcessedDocument.organization_id == org_id).first() is None
    assert db_session.query(Forecast).filter(Forecast.organization_id == org_id).first() is None
    assert db_session.query(Recommendation).filter(Recommendation.organization_id == org_id).first() is None
    assert db_session.query(Report).filter(Report.organization_id == org_id).first() is None
    assert db_session.query(SystemError).filter(SystemError.organization_id == org_id).first() is None
    assert db_session.query(AuditLog).filter(AuditLog.organization_id == org_id).first() is None
    assert db_session.query(ConversationSession).filter(ConversationSession.organization_id == org_id).first() is None
    assert db_session.query(ChatMessage).filter(ChatMessage.session_id == conversation_session_id).first() is None
    assert db_session.query(MemoryEntry).filter(MemoryEntry.organization_id == org_id).first() is None
    assert db_session.query(Expense).filter(Expense.organization_id == org_id).first() is None
    assert db_session.query(IntelligenceSnapshot).filter(IntelligenceSnapshot.organization_id == org_id).first() is None
    assert db_session.query(BusinessGoal).filter(BusinessGoal.organization_id == org_id).first() is None
    assert db_session.query(ExecutiveConversation).filter(ExecutiveConversation.organization_id == org_id).first() is None
    assert db_session.query(ExecutiveMessage).filter(ExecutiveMessage.conversation_id == executive_conversation_id).first() is None
    assert db_session.query(AIRecommendation).filter(AIRecommendation.organization_id == org_id).first() is None
