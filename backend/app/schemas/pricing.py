# ==============================================================================
# PURPOSE: Pydantic schemas for Pricing suggestions and profit modeling.
# DATA FLOW: Populated by Pricing Agent/service, parsed by routers to output dashboard recommendations.
# EXTENSION POINTS: Add volume tiers, discounts, promotional periods, or competitor price channels.
# ARCHITECTURAL DECISION:
# - Connects price adjustments directly to revenue/profit projections to demonstrate clear ROI.
# ==============================================================================

from typing import List
from pydantic import BaseModel, Field


class SKUPricingRecommendation(BaseModel):
    """
    Pricing and margin analysis recommendations for a single SKU.
    """
    sku: str = Field(..., description="Target SKU")
    name: str = Field(..., description="Product name")
    unit_cost: float = Field(..., description="Current cost of goods sold (COGS)")
    current_price: float = Field(..., description="Active MSRP or sales price")
    recommended_price: float = Field(..., description="Price suggested by dynamic optimizer")
    current_margin: float = Field(..., description="Current margin percentage, e.g. 0.60 for 60%")
    recommended_margin: float = Field(..., description="Projected margin percentage under recommended price")
    price_change_percentage: float = Field(..., description="Suggested percentage price delta")
    elasticity_score: float = Field(..., description="Estimated price elasticity coefficient")
    projected_volume_change_pct: float = Field(..., description="Forecasted sales volume shift percentage")
    projected_revenue_impact: float = Field(..., description="Projected gross revenue change")
    projected_profit_impact: float = Field(..., description="Projected net profit change")
    recommendation_reason: str = Field(..., description="Text explanation of the price suggestion")


class PricingOverview(BaseModel):
    """
    Aggregate pricing analytics and recommendations summary.
    """
    organization_id: int
    average_current_margin: float = Field(..., description="Average margin across catalog today")
    average_recommended_margin: float = Field(..., description="Target average margin based on suggestions")
    estimated_revenue_impact: float = Field(..., description="Summed revenue delta across recommended items")
    estimated_profit_impact: float = Field(..., description="Summed profit delta across recommended items")
    recommendations: List[SKUPricingRecommendation] = Field(default_factory=list, description="SKU recommendations list")
