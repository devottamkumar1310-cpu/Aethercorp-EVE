# ==============================================================================
# PURPOSE: Market Agent.
# DATA FLOW: Reads competitor pricing indices and trend reports, providing consumer demand insights.
# EXTENSION POINTS: Add social sentiment feeds, catalog colorways popularity reports.
# ==============================================================================

import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.core.agent_registry import register_agent

logger = logging.getLogger("eve.agents.market.market_agent")


@register_agent(
    role="market",
    name="Market Intelligence Agent",
    description="Monitors fashion trends, competitor pricing, and demand indices.",
    tools=["monitor_competitor_prices"],
    capabilities=["competitor_price_tracking", "trend_monitoring", "demand_signal_analysis"],
    supported_tasks=["fetch_competitor_prices", "identify_trending_categories"]
)
class MarketAgent(BaseAgent):
    """
    Agent responsible for monitoring external market triggers.
    """
    role: str = "market"
    name: str = "Market Intelligence Agent"
    system_prompt: str = (
        "You are the Market Intelligence Agent of EVE. Your goal is to keep track of competitor pricing "
        "and consumer demand indices. Use your tool `monitor_competitor_prices` to inspect what similar products "
        "are selling for in the market, and feed this context back to help the brand optimize its catalog."
    )
    tools = ["monitor_competitor_prices"]

    def __init__(self, db: Optional[Session] = None):
        super().__init__(db=db)
