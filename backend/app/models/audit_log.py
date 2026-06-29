import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UUID, Text, JSON
from app.database import Base

class AuditLog(Base):
    """
    SaaS Security and Compliance Audit Log.
    Stores security, event, and debug traces.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)  # "CSV_UPLOAD", "AGENT_EXECUTION", "CHAT_REQUEST", "AUTH_EVENT", "SYSTEM_ERROR"
    status = Column(String, nullable=False, index=True)      # "SUCCESS", "FAILURE", "WARNING"
    message = Column(Text, nullable=True)
    client_ip = Column(String, nullable=True)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

