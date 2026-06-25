from sqlalchemy import DateTime
import uuid
# ==============================================================================
# PURPOSE: Database models for Organization and Membership mapping (SaaS multi-tenancy).
# DATA FLOW: DB queries retrieve tenant status and membership access controls.
# EXTENSION POINTS: Add custom organization settings (e.g. tier, custom domains, branding).
# ARCHITECTURAL DECISION:
# - All major data models (Product, Supplier, Artifact, etc.) carry an `organization_id`
#   to enforce strict logical multi-tenant isolation.
# ==============================================================================

import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Organization(Base):
    """
    Represents a tenant organization (e.g. a D2C fashion brand).
    """
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    memberships = relationship("Membership", back_populates="organization", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="organization", cascade="all, delete-orphan")
    suppliers = relationship("Supplier", back_populates="organization", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="organization", cascade="all, delete-orphan")
    inventory_items = relationship("InventoryItem", back_populates="organization", cascade="all, delete-orphan")
    sales_records = relationship("SalesRecord", back_populates="organization", cascade="all, delete-orphan")
    sessions = relationship("ConversationSession", back_populates="organization", cascade="all, delete-orphan")
    memories = relationship("MemoryEntry", back_populates="organization", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="organization", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="organization", cascade="all, delete-orphan")
    revenues = relationship("Revenue", back_populates="organization", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="organization", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="organization", cascade="all, delete-orphan")
    intelligence_snapshots = relationship("IntelligenceSnapshot", back_populates="organization", cascade="all, delete-orphan")
    business_goals = relationship("BusinessGoal", back_populates="organization", cascade="all, delete-orphan")
    executive_conversations = relationship("ExecutiveConversation", back_populates="organization", cascade="all, delete-orphan")
    ai_recommendations = relationship("AIRecommendation", back_populates="organization", cascade="all, delete-orphan")
    processed_documents = relationship("ProcessedDocument", back_populates="organization", cascade="all, delete-orphan")
    forecasts = relationship("Forecast", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", cascade="all, delete-orphan")
    reports = relationship("Report", cascade="all, delete-orphan")
    system_errors = relationship("SystemError", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", cascade="all, delete-orphan")


class Membership(Base):
    """
    Maps a User to an Organization with role permissions (e.g. admin, member, owner).
    """
    __tablename__ = "memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="member", nullable=False)  # owner, admin, member
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="memberships")
    profile = relationship("Profile", back_populates="memberships")
