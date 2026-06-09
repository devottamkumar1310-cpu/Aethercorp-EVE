from sqlalchemy import DateTime
import uuid
# ==============================================================================
# PURPOSE: Database models for Inventory states and Sales histories.
# DATA FLOW: Updated by CSV pipelines, read by inventory/pricing agents to compute risk scores,
#            reorder suggestions, dead stock flags, and sales velocities.
# EXTENSION POINTS: Add warehouse location ids, stock adjustments (damaged, lost), and returns.
# ARCHITECTURAL DECISION:
# - Logically separates InventoryItem (current state) from SalesRecord (historical logs).
# ==============================================================================

import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class InventoryItem(Base):
    """
    Represents the current warehouse/sales-channel stock level of a product.
    """
    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    stock_on_hand = Column(Integer, default=0, nullable=False)
    reorder_point = Column(Integer, default=0, nullable=False)
    safety_stock = Column(Integer, default=0, nullable=False)
    lead_time_days = Column(Integer, default=14, nullable=False)
    avg_daily_sales = Column(Float, default=0.0) # Calculated rolling daily sales rate
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="inventory_items")
    product = relationship("Product", back_populates="inventory_items")


class SalesRecord(Base):
    """
    Represents an aggregated sales record for a given day and product.
    Allows calculating velocity, demand forecasts, and seasonality.
    """
    __tablename__ = "sales_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    revenue = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="sales_records")
    product = relationship("Product", back_populates="sales_records")
