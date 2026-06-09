from sqlalchemy import DateTime
import uuid
# ==============================================================================
# PURPOSE: Database model for Suppliers/Manufacturers.
# DATA FLOW: Read by sourcing agents for comparison, lead time calculation, and PO/RFQ generation.
# EXTENSION POINTS: Add supplier tiers, quality scores, contract terms, and catalog pricelists.
# ARCHITECTURAL DECISION:
# - Linked to organization_id for tenant separation.
# ==============================================================================

import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Supplier(Base):
    """
    Represents a third-party clothing manufacturer or supplier.
    """
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    contact_email = Column(String, nullable=True)
    location = Column(String, nullable=True)       # e.g., China, Portugal, India, Turkey
    lead_time_days = Column(Integer, default=30)  # Average production turnaround time
    minimum_order_qty = Column(Integer, default=100)
    reliability_score = Column(Float, default=1.0) # 0.0 to 1.0 based on historical delivery performance
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="suppliers")
