# ==============================================================================
# PURPOSE: Inventory Agent.
# DATA FLOW: Reads stock states and velocities, writing reorder suggestions and risk metrics.
# EXTENSION POINTS: Add size run curve distribution updates.
# ==============================================================================

import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.core.agent_registry import register_agent

logger = logging.getLogger("eve.agents.inventory.inventory_agent")


@register_agent(
    role="inventory",
    name="Inventory Optimization Agent",
    description="Analyzes stock coverage, safety stock levels, and prepares reorders.",
    tools=["run_inventory_analysis"],
    capabilities=["stock_health_analysis", "safety_stock_calculation", "reorder_recommendations", "dead_stock_detection"],
    supported_tasks=["evaluate_stock_levels", "flag_dead_stock", "calculate_replenishment"]
)
class InventoryAgent(BaseAgent):
    """
    Agent responsible for monitoring inventory health and risk factors.
    """
    role: str = "inventory"
    name: str = "Inventory Optimization Agent"
    system_prompt: str = (
        "You are the Inventory Optimization Agent of EVE. Your goal is to keep track of stock levels, "
        "detect dead stock, calculate safety stock limits, and recommend POs (Purchase Orders).\n\n"
        "Instructions:\n"
        "1. Call the `run_inventory_analysis` tool to inspect current inventory status.\n"
        "2. Formulate strategic replenishment advice: highlight high stockout risk SKUs and suggest markdowns "
        "for dead stock items to free up warehouse space."
    )
    tools = ["run_inventory_analysis"]

    def __init__(self, db: Optional[Session] = None):
        super().__init__(db=db)

    async def run(
        self,
        task_description: str,
        organization_id: int,
        context: Optional[Dict[str, Any]] = None
    ) -> "AgentResponseSchema": # type: ignore
        """
        Executes inventory tasks. Enforces deterministic calculations BEFORE passing to LLM.
        """
        from app.services.analytics_service import AnalyticsService
        from typing import Dict, Any
        
        # 1. Fetch exact calculations from the Business Intelligence engine
        metrics = AnalyticsService.get_dashboard_metrics(self.db, organization_id)
        
        # 2. Add calculated metrics directly into the context
        if context is None:
            context = {}
            
        context["deterministic_bi_calculations"] = metrics
        
        # 3. Explicitly instruct Gemini to only summarize
        augmented_prompt = (
            f"The deterministic Business Intelligence engine has calculated the following metrics:\n"
            f"{metrics}\n\n"
            f"Original user task: {task_description}\n\n"
            "CRITICAL REQUIREMENT: Do not invent or recalculate any numbers. "
            "Act as the Explanation Layer. Summarize these exact metrics and explain what they mean to the founder."
        )
        
        logger.info(f"--- GEMINI PROMPT CONTEXT ---\n{augmented_prompt}\n-----------------------------")
        
        response = await super().run(
            task_description=augmented_prompt, 
            organization_id=organization_id, 
            context=context
        )
        
        # Inject deterministic BI calculations into the LLM result for the Orchestrator
        if isinstance(response.result, dict):
            response.result.update(metrics)
            
        return response
