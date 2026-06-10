# ==============================================================================
# PURPOSE: Executive Orchestrator Agent (CEO Agent).
# DATA FLOW: Takes overall user goal -> decomposes into task steps -> routes tasks to specialized agents ->
#            validates outputs -> compiles and saves the final executive report.
# EXTENSION POINTS: Add custom reporting templates, supervisor routing rules, or interactive human-in-the-loop steps.
# ARCHITECTURAL DECISION:
# - Serves as the master coordinator. Registers dynamically with AgentRegistry.
# - Decoupled from hardcoded specialized agents, allowing easy extension of roles.
# ==============================================================================

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.core.agent_registry import register_agent
from app.schemas.agent_response import AgentResponseSchema

logger = logging.getLogger("eve.agents.executive_orchestrator")


@register_agent(
    role="executive",
    name="Executive Orchestrator",
    description="Decomposes user requests, orchestrates multi-agent tasks, and generates final synthesized reports.",
    tools=[],
    capabilities=["task_decomposition", "dynamic_agent_discovery", "result_aggregation", "executive_report_synthesis"],
    supported_tasks=["orchestrate_multi_agent_goal", "synthesize_final_responses"]
)
class ExecutiveOrchestrator(BaseAgent):
    """
    Supervisor Agent representing EVE's executive intellect.
    """
    role: str = "executive"
    name: str = "Executive Orchestrator"
    system_prompt: str = (
        "You are EVE (Enterprise Virtual Executive), the CEO Agent of a multi-agent system designed "
        "to optimize D2C fashion brands. Your primary role is to decompose user requests, delegate tasks "
        "to specialized agents, validate their findings, and compile high-level executive reports.\n\n"
        "Instructions:\n"
        "1. Decompose complex user goals into logical execution plans (DAGs of task nodes).\n"
        "2. Ensure data outputs from Inventory, Sourcing, and Pricing are validated for math consistency.\n"
        "3. Synthesize the final results into an executive summary emphasizing key risks and profit impact."
    )

    def __init__(self, db: Optional[Session] = None):
        super().__init__(db=db)

    async def compile_report(
        self,
        task_graph_outputs: Dict[str, Any],
        organization_id: int
    ) -> Dict[str, Any]:
        """
        Synthesizes intermediate outputs from multiple agents into a single unified report.
        """
        logger.info(f"CEO Agent compiling final executive report for organization {organization_id}...")
        
        inventory_result = {}
        pricing_result = {}
        analytics_result = {}
        forecasting_result = {}

        for node_id, output in task_graph_outputs.items():
            if "inventory" in node_id or output.get("agent_role") == "inventory":
                inventory_result.update(output.get("result", {}))
            elif "pricing" in node_id or output.get("agent_role") == "pricing":
                pricing_result.update(output.get("result", {}))
            elif "analytics" in node_id or output.get("agent_role") == "analytics":
                analytics_result.update(output.get("result", {}))
            elif "forecasting" in node_id or output.get("agent_role") == "forecasting":
                forecasting_result.update(output.get("result", {}))

        # Core Metrics
        inventory_risk_score = inventory_result.get("inventory_risk_score", inventory_result.get("average_risk_score", 50.0))
        reorder_recommendations = inventory_result.get("reorder_recommendations", inventory_result.get("items_at_risk", []))
        dead_stock_alerts = inventory_result.get("dead_stock_items", [])
        
        pricing_recommendations = pricing_result.get("pricing_recommendations", pricing_result.get("recommendations", inventory_result.get("pricing_recommendations", [])))
        estimated_profit_impact = pricing_result.get("estimated_profit_impact", inventory_result.get("estimated_profit_impact", 0.0))

        # Handle explicit scenario outputs if forecasting ran
        scenario_output = None
        if forecasting_result.get("scenario"):
            scenario_output = forecasting_result

        # Generate Top 3 Actions
        top_actions = []
        if reorder_recommendations:
            qty = sum(rec.get("recommended_reorder", 0) if isinstance(rec, dict) else rec for rec in reorder_recommendations)
            top_actions.append({
                "action": f"Reorder {qty} units immediately",
                "impact": "Prevent stockout revenue loss",
                "confidence_score": 92
            })
        if pricing_recommendations:
            # Get the top pricing recommendation by impact
            top_actions.append({
                "action": f"Increase {pricing_recommendations[0].get('sku', 'items')} price by {pricing_recommendations[0].get('price_change_percentage', 10.0)}%",
                "impact": f"Boost margin by {pricing_recommendations[0].get('recommended_margin', 0) - pricing_recommendations[0].get('current_margin', 0):.1f}%",
                "confidence_score": 88
            })
        if dead_stock_alerts:
            top_actions.append({
                "action": f"Liquidate {len(dead_stock_alerts)} dead stock SKUs",
                "impact": "Free up warehouse capital",
                "confidence_score": 95
            })
            
        # Fallback if no actions
        if not top_actions:
            top_actions = [{"action": "Maintain current operations", "impact": "Stable", "confidence_score": 99}]
            
        # Limit to Top 3
        top_actions = top_actions[:3]

        # Structure executive report JSON
        executive_summary = {
            "inventory_risk_score": inventory_risk_score,
            "total_reorder_recommendations": len(reorder_recommendations),
            "total_dead_stock_items": len(dead_stock_alerts),
            "total_pricing_adjustments": len(pricing_recommendations),
            "estimated_profit_impact": estimated_profit_impact,
            "scenario_simulation": scenario_output,
            "top_3_actions": top_actions,
            "strategic_recommendation": (
                f"Actions required: Replenish {len(reorder_recommendations)} critical SKUs immediately "
                f"to prevent stockouts. Implement {len(pricing_recommendations)} pricing suggestions to "
                f"boost margin, yielding a projected profit impact of ${estimated_profit_impact:,.2f}."
            ),
            "agent_telemetry": {
                "nodes_executed": list(task_graph_outputs.keys())
            }
        }
        
        return executive_summary
