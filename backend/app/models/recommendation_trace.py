import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, UUID, Float
from sqlalchemy.orm import relationship
from app.database import Base


class RecommendationTrace(Base):
    """
    Stores explainable AI metadata, supporting metrics, and reasoning logs
    for every recommendation generated across EVE modules.
    """
    __tablename__ = "recommendation_traces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_type = Column(String, nullable=False)  # "inventory", "reorder", "margin", "forecasting", "summary"
    action = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False, default=1.0)
    validation_status = Column(String, default="verified", nullable=False)  # "verified", "soft_check", "unchecked"
    source_datasets = Column(JSON, nullable=False)  # List of strings/IDs representing source data
    supporting_metrics = Column(JSON, nullable=False)  # Dictionary of metrics
    reasoning_chain = Column(JSON, nullable=False)  # List of string reasoning steps
    evidence_snapshot = Column(JSON, nullable=False, default=dict)  # Immutable snapshot at recommendation time
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="recommendation_traces")
