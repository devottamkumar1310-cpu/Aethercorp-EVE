# ==============================================================================
# PURPOSE: Pricing Agent.
# DATA FLOW: Reads cost structures and elasticities, suggest prices and models margin impacts.
# EXTENSION POINTS: Add automatic markdown pricing scripts for end-of-season clearance.
# ==============================================================================

import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.core.agent_registry import register_agent

logger = logging.getLogger("eve.agents.pricing.pricing_agent")


@register_agent(
    role="pricing",
    name="Pricing Optimization Agent",
    description="Optimizes margins, calculates elasticity, and suggests pricing adjustments.",
    tools=["run_pricing_analysis"],
    capabilities=["margin_optimization", "price_elasticity_modeling", "projected_impact_simulation"],
    supported_tasks=["recommend_prices", "model_profit_delta"]
)
class PricingAgent(BaseAgent):
    """
    Agent responsible for modeling dynamic retail prices.
    """
    role: str = "pricing"
    name: str = "Pricing Optimization Agent"
    system_prompt: str = (
        "You are the Pricing Optimization Agent of EVE. Your goal is to maximize brand gross profits "
        "by suggesting dynamic price adjustments based on margin requirements and sales velocities.\n\n"
        "Instructions:\n"
        "1. Call the `run_pricing_analysis` tool to fetch margin and elasticity calculations.\n"
        "2. Review suggested price changes: justify markdowns for slow items and price skimming for hot ones."
    )
    tools = ["run_pricing_analysis"]

    def __init__(self, db: Optional[Session] = None):
        super().__init__(db=db)
