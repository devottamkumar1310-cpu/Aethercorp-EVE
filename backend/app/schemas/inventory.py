# ==============================================================================
# PURPOSE: Pydantic schemas for Inventory health and analytics.
# DATA FLOW: Populated by the Inventory Agent/service, serialized to REST JSON responses.
# EXTENSION POINTS: Add warehouse storage tier flags, safety factors, or vendor availability fields.
# ARCHITECTURAL DECISION:
# - Standardizes the output parameters of the Inventory Optimization workflow.
# ==============================================================================

from typing import List
from pydantic import BaseModel, Field


class SKUInventoryAnalysis(BaseModel):
    """
    Detailed inventory health metrics for a specific product SKU.
    """
    sku: str = Field(..., description="Unique product SKU")
    name: str = Field(..., description="Product name")
    category: str = Field(..., description="Product category")
    stock_on_hand: int = Field(..., description="Current quantity in stock")
    safety_stock: int = Field(..., description="Safety stock levels calculated")
    reorder_point: int = Field(..., description="Calculated reorder point threshold")
    reorder_quantity: int = Field(..., description="Recommended quantity to order")
    lead_time_days: int = Field(..., description="Supplier lead time in days")
    avg_daily_sales: float = Field(..., description="Rolling average daily sales velocity")
    days_until_stockout: float = Field(..., description="Calculated days left before stock runs out")
    stockout_risk_score: float = Field(..., description="Risk score from 0 (Safe) to 100 (Critical)")
    is_dead_stock: bool = Field(default=False, description="Flag indicating if the product is dead stock")
    sell_through_rate: float = Field(default=0.0, description="Sell through percentage")


class InventoryOverview(BaseModel):
    """
    High-level inventory health summary metrics for the brand.
    """
    organization_id: int
    total_skus: int = Field(..., description="Total unique SKUs tracked")
    out_of_stock_skus: int = Field(..., description="Number of items currently out of stock")
    low_stock_skus: int = Field(..., description="Number of items below reorder point")
    dead_stock_skus: int = Field(..., description="Number of items flagged as dead stock")
    average_risk_score: float = Field(..., description="Average stockout risk score across all products")
    estimated_reorder_cost: float = Field(..., description="Total cost of recommended reorders")
    items_at_risk: List[SKUInventoryAnalysis] = Field(default_factory=list, description="List of items requiring immediate attention")
