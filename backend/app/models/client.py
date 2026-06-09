import uuid
import datetime
from sqlalchemy import Column, String, DateTime, UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    company_name = Column(String, index=True, nullable=False)
    contact_person = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    status = Column(String, index=True, default="lead") # lead, active, inactive

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="client", cascade="all, delete-orphan")
