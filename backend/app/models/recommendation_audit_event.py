import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class RecommendationAuditEvent(Base):
    """
    Immutable audit history for recommendation traces.
    """
    __tablename__ = "recommendation_audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trace_id = Column(UUID(as_uuid=True), ForeignKey("recommendation_traces.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # CREATED, VALIDATED, REJECTED, VIEWED, UPDATED
    user_id = Column(UUID(as_uuid=True), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    details = Column(JSON, nullable=True)

    # Relationships
    trace = relationship("RecommendationTrace", back_populates="audit_events")
