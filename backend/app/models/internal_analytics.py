import datetime
import uuid
from sqlalchemy import Column, String, DateTime, Integer, Float, JSON, UUID
from app.database import Base


class InternalAnalyticsEvent(Base):
    """
    Stores platform telemetry events for owner/admin analytics.
    Completely decoupled from production business tables.
    """
    __tablename__ = "internal_analytics_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    event_type = Column(String, index=True, nullable=False)  # e.g., "login", "signup", "csv_upload", "ai_query", "api_request", "error"
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    endpoint = Column(String, nullable=True)
    status_code = Column(Integer, default=200, nullable=True)
    latency_ms = Column(Float, default=0.0, nullable=True)
    metadata_json = Column(JSON, default={}, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
