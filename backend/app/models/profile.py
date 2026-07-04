from sqlalchemy import DateTime
import uuid
# ==============================================================================
# PURPOSE: Database model for User identity.
# DATA FLOW: Handles password verifications, user details, and active membership roles.
# EXTENSION POINTS: Add profile details, phone numbers, OAuth providers, or active session tokens.
# ARCHITECTURAL DECISION:
# - Users can belong to multiple organizations via the Membership join table.
# ==============================================================================

import datetime
from sqlalchemy import Column, String, Boolean, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Profile(Base):
    """
    Represents a user account in the EVE system.
    """
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    timezone = Column(String, default="UTC", nullable=False)
    language = Column(String, default="en", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    memberships = relationship("Membership", back_populates="profile", cascade="all, delete-orphan")
