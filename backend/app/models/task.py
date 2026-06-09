import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    
    priority = Column(String, index=True, default="medium") # low, medium, high, critical
    status = Column(String, index=True, default="todo") # todo, in_progress, completed
    due_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("Profile")
