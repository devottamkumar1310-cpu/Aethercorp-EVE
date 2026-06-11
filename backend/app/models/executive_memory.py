import uuid
import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, UUID, Text
from sqlalchemy.orm import relationship
from app.database import Base

class BusinessGoal(Base):
    """
    Tracks strategic active business goals set by the user/executive.
    """
    __tablename__ = "business_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    goal_type = Column(String, nullable=False)  # e.g., "profitability", "growth", "cost_reduction", "retention", "custom"
    description = Column(Text, nullable=False)
    target_value = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="business_goals")
