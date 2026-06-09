from sqlalchemy import DateTime
import uuid
# ==============================================================================
# PURPOSE: Database model for Products in the catalog.
# DATA FLOW: Read by agents for catalogs, pricing suggestions, and inventory health reviews.
# EXTENSION POINTS: Add attributes for colorways, materials, sizing types (e.g. waist sizes), images.
# ARCHITECTURAL DECISION:
# - Products are tied to an organization_id for multi-tenancy logical separation.
# - SKUs must be unique within an organization, enforced programmatically.
# - Added unit_cost, selling_price, and supplier_name to map incoming product cost CSVs cleanly.
# ==============================================================================

import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Float, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Product(Base):
    """
    Represents a fashion product item in the brand's catalog.
    """
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    sku = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # e.g., Tops, Bottoms, Dresses, Outerwear
    season = Column(String, nullable=True)     # e.g., Summer 2026, Autumn 2026
    size_curve = Column(JSON, nullable=True)   # e.g., {"XS": 0.1, "S": 0.2, "M": 0.4, "L": 0.2, "XL": 0.1}
    unit_cost = Column(Float, default=0.0, nullable=False)    # Supplier unit cost (COGS)
    selling_price = Column(Float, default=0.0, nullable=False) # Target retail selling price
    supplier_name = Column(String, nullable=True)             # Sourced supplier name
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="products")
    inventory_items = relationship("InventoryItem", back_populates="product", cascade="all, delete-orphan")
    sales_records = relationship("SalesRecord", back_populates="product", cascade="all, delete-orphan")
