import uuid
import datetime
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), index=True, nullable=False)
    budget = Column(Float, default=0.0)
    status = Column(String, index=True, default="planned") # planned, active, completed, on_hold
    start_date = Column(DateTime, nullable=True)
    deadline = Column(DateTime, index=True, nullable=True)

    # Mandatory Additions #2
    completion_percentage = Column(Float, default=0.0)
    estimated_hours = Column(Float, default=0.0)
    actual_hours = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="projects")
    client = relationship("Client", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    revenues = relationship("Revenue", back_populates="project", cascade="all, delete-orphan")
