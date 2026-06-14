import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UUID, Text, JSON
from app.database import Base

class SystemError(Base):
    """
    Stores system-level error and failure logs (backend exceptions, Gemini failures, database failures, frontend errors).
    """
    __tablename__ = "system_errors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    component = Column(String, nullable=False)  # "frontend" | "backend" | "database" | "gemini" | "rate_limiter"
    error_type = Column(String, nullable=False)  # "DATABASE_ERROR", "GEMINI_ERROR", etc.
    message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
