from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

class IntelligenceSnapshot(Base):
    __tablename__ = "intelligence_snapshots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    snapshot_date = Column(DateTime(timezone=True), default=func.now())

    # Relationships
    organization = relationship("Organization", back_populates="intelligence_snapshots")
    
    health_score = Column(Float, default=0.0)
    
    total_clients = Column(Integer, default=0)
    active_clients = Column(Integer, default=0)
    
    total_projects = Column(Integer, default=0)
    active_projects = Column(Integer, default=0)
    
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    
    revenue = Column(Float, default=0.0)
    expenses = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
