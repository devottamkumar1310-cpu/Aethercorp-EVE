import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UUID, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class ExecutiveConversation(Base):
    """
    Stores a multi-turn chat conversation session with EVE AI COO.
    """
    __tablename__ = "executive_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="executive_conversations")
    messages = relationship("ExecutiveMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ExecutiveMessage.created_at")


class ExecutiveMessage(Base):
    """
    Stores individual messages within an ExecutiveConversation.
    """
    __tablename__ = "executive_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("executive_conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    
    # Store agent_data as JSON: reasoning_summary, data_used, risk_factors, opportunity_factors, confidence_level, agent_sources
    agent_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    conversation = relationship("ExecutiveConversation", back_populates="messages")
