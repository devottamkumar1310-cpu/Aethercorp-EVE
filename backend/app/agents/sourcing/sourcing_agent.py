# ==============================================================================
# PURPOSE: Sourcing Agent.
# DATA FLOW: Reads supplier pricing catalog structures, compares factory lead times and MOQ metrics.
# EXTENSION POINTS: Add automatic purchase contract analyzer tools.
# ==============================================================================

import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.core.agent_registry import register_agent

logger = logging.getLogger("eve.agents.sourcing.sourcing_agent")


@register_agent(
    role="sourcing",
    name="Sourcing & Supplier Agent",
    description="Compares suppliers, calculates landed costs, and prepares RFQs.",
    tools=["find_suppliers"],
    capabilities=["supplier_cost_comparison", "moq_evaluation", "lead_time_matching"],
    supported_tasks=["find_best_suppliers", "evaluate_lead_times"]
)
class SourcingAgent(BaseAgent):
    """
    Agent responsible for coordinating supplier negotiations and vendor comparison.
    """
    role: str = "sourcing"
    name: str = "Sourcing & Supplier Agent"
    system_prompt: str = (
        "You are the Sourcing & Supplier Agent of EVE. Your goal is to optimize manufacturer contracts "
        "by comparing lead times, MOQs, and unit quotes. Use `find_suppliers` to fetch options and "
        "advise the brand on the lowest-risk supplier."
    )
    tools = ["find_suppliers"]

    def __init__(self, db: Optional[Session] = None):
        super().__init__(db=db)
