import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, UUID, Float, Boolean, Text, Integer
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
    validation_status = Column(String, default="GENERATED", nullable=False)  # GENERATED, USER_PROMPTED, SYSTEM_GENERATED, VALIDATED, REJECTED
    source_datasets = Column(JSON, nullable=False)  # List of strings/IDs representing source data
    supporting_metrics = Column(JSON, nullable=False)  # Dictionary of metrics
    reasoning_chain = Column(JSON, nullable=False)  # List of string reasoning steps
    evidence_snapshot = Column(JSON, nullable=False, default=dict)  # Immutable snapshot at recommendation time
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Phase 2: Trace Origin Attribution
    triggered_by_user_id = Column(UUID(as_uuid=True), nullable=True)
    triggered_by_email = Column(String, nullable=True)
    trigger_type = Column(String, nullable=True) # USER_PROMPT, SYSTEM_ALERT, SCHEDULED_ANALYSIS, BACKGROUND_MONITOR, EXECUTIVE_BOARD
    source_agent = Column(String, nullable=True)
    created_from_query = Column(Boolean, nullable=True, default=False)

    # Phase 3: LLM Provenance
    llm_provider = Column(String, nullable=True)
    llm_model = Column(String, nullable=True)
    llm_model_version = Column(String, nullable=True)
    temperature = Column(Float, nullable=True)
    top_p = Column(Float, nullable=True)
    top_k = Column(Integer, nullable=True)
    system_prompt_hash = Column(String, nullable=True)
    raw_prompt = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)
    response_timestamp = Column(DateTime, nullable=True)

    # Phase 6: True Decision Trace Structure
    input_metrics = Column(JSON, nullable=True)
    business_rules = Column(JSON, nullable=True)
    calculations = Column(JSON, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="recommendation_traces")
    audit_events = relationship("RecommendationAuditEvent", back_populates="trace", cascade="all, delete-orphan")
