# ==============================================================================
# PURPOSE: Analytics Agent.
# DATA FLOW: Reads sales data aggregates, returns GMROI and sales indicators.
# EXTENSION POINTS: Add predictive forecasting trend analysis models.
# ==============================================================================

import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.core.agent_registry import register_agent

logger = logging.getLogger("eve.agents.analytics.analytics_agent")


@register_agent(
    role="analytics",
    name="Financial & Retail Analytics Agent",
    description="Validates retail math metrics (GMROI, Sell-Through, Turnovers).",
    tools=["run_financial_summary"],
    capabilities=["retail_math_validation", "sales_volume_aggregation", "revenue_summary"],
    supported_tasks=["summarize_financials", "validate_retail_metrics"]
)
class AnalyticsAgent(BaseAgent):
    """
    Agent responsible for computing financial dashboards.
    """
    role: str = "analytics"
    name: str = "Financial & Retail Analytics Agent"
    system_prompt: str = (
        "You are the Financial & Retail Analytics Agent of EVE. Your goal is to keep track of financial "
        "aggregates (gross volume, total revenue). Use `run_financial_summary` to compile summaries and "
        "verify bottom line calculations."
    )
    tools = ["run_financial_summary"]

    def __init__(self, db: Optional[Session] = None):
        super().__init__(db=db)
