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
        
        pricing_failed = False
        inventory_failed = False

        pricing_result = {}
        inventory_result = {}

        for node_id, output in task_graph_outputs.items():
            if "pricing" in node_id or (isinstance(output, dict) and output.get("agent_role") == "pricing"):
                if isinstance(output, dict) and output.get("status") == "failed":
                    pricing_failed = True
                else:
                    pricing_result.update(output.get("result", {}) if isinstance(output, dict) and "result" in output else (output if isinstance(output, dict) else {}))
            elif "inventory" in node_id or (isinstance(output, dict) and output.get("agent_role") == "inventory"):
                if isinstance(output, dict) and output.get("status") == "failed":
                    inventory_failed = True
                else:
                    inventory_result.update(output.get("result", {}) if isinstance(output, dict) and "result" in output else (output if isinstance(output, dict) else {}))

        from app.services.analytics_service import AnalyticsService
        try:
            metrics = AnalyticsService.get_dashboard_metrics(self.db, organization_id)
        except Exception as err:
            logger.error(f"Failed to fetch aligned metrics from AnalyticsService: {err}")
            metrics = {}

        # Core Metrics alignment and failure recovery
        if inventory_failed:
            inventory_risk_score = 50.0
            reorder_recommendations = []
            dead_stock_alerts = []
            inventory_summary_text = "Inventory analysis unavailable."
        else:
            inventory_risk_score = metrics.get("inventory_risk_score", inventory_result.get("inventory_risk_score", inventory_result.get("average_risk_score", 50.0)))
            reorder_recommendations = metrics.get("reorder_recommendations", inventory_result.get("reorder_recommendations", inventory_result.get("items_at_risk", [])))
            dead_stock_alerts = metrics.get("dead_stock_items", inventory_result.get("dead_stock_items", []))
            inventory_summary_text = f"Replenish {len(reorder_recommendations)} critical SKUs immediately to prevent stockouts."

        if pricing_failed:
            pricing_recommendations = []
            estimated_profit_impact = 0.0
            pricing_summary_text = "Pricing analysis unavailable."
        else:
            pricing_recommendations = metrics.get("pricing_recommendations", pricing_result.get("pricing_recommendations", pricing_result.get("recommendations", [])))
            estimated_profit_impact = metrics.get("estimated_profit_impact", pricing_result.get("estimated_profit_impact", 0.0))
            pricing_summary_text = f"Implement {len(pricing_recommendations)} pricing suggestions to boost margin, yielding a projected profit impact of ${estimated_profit_impact:,.2f}."

        # Handle explicit scenario outputs if forecasting ran
        scenario_output = None
        for node_id, output in task_graph_outputs.items():
            if "forecasting" in node_id or (isinstance(output, dict) and output.get("agent_role") == "forecasting"):
                if isinstance(output, dict) and output.get("status") != "failed":
                    scenario_output = output

        # Generate Top 3 Actions
        top_actions = []
        if not inventory_failed and reorder_recommendations:
            qty = sum(rec.get("recommended_reorder", 0) if isinstance(rec, dict) else rec for rec in reorder_recommendations)
            top_actions.append({
                "action": f"Reorder {qty} units immediately",
                "why": "Safety stock levels are violated. Replenish immediately to prevent stockouts and revenue loss.",
                "explanation": "Safety stock levels are violated. Replenish immediately to prevent stockouts and revenue loss.",
                "expected_impact": "Prevent stockout revenue loss",
                "impact": "Prevent stockout revenue loss",
                "confidence": 92,
                "confidence_score": 92
            })
        if not pricing_failed and pricing_recommendations:
            first_rec = pricing_recommendations[0]
            top_actions.append({
                "action": f"Adjust {first_rec.get('sku')} price to ${first_rec.get('recommended_price')}",
                "why": f"Optimize listing price for {first_rec.get('sku')} based on price elasticity analysis to capture maximum profit margin.",
                "explanation": f"Optimize listing price for {first_rec.get('sku')} based on price elasticity analysis to capture maximum profit margin.",
                "expected_impact": "Margin optimization",
                "impact": "Margin optimization",
                "confidence": 88,
                "confidence_score": 88
            })
        if not inventory_failed and dead_stock_alerts:
            top_actions.append({
                "action": f"Liquidate {len(dead_stock_alerts)} dead stock SKUs",
                "why": "Free up locked working capital and reduce carrying costs by discounting slow-moving or dead apparel stock.",
                "explanation": "Free up locked working capital and reduce carrying costs by discounting slow-moving or dead apparel stock.",
                "expected_impact": "Free up warehouse capital",
                "impact": "Free up warehouse capital",
                "confidence": 95,
                "confidence_score": 95
            })
            
        # Fallback if no actions
        if not top_actions:
            top_actions = [{
                "action": "Maintain current operations", 
                "why": "All inventory, margins, and sales metrics are within safe operating thresholds.",
                "explanation": "All inventory, margins, and sales metrics are within safe operating thresholds.",
                "expected_impact": "Stable", 
                "impact": "Stable", 
                "confidence": 99,
                "confidence_score": 99
            }]
            
        # Limit to Top 3
        top_actions = top_actions[:3]

        # Strategic recommendation summary construction
        if scenario_output:
            res_dict = scenario_output.get("result", {}) if isinstance(scenario_output, dict) else getattr(scenario_output, "result", {})
            explanation = res_dict.get("explanation", "")
            if explanation:
                strategic_rec = explanation
            else:
                strategic_rec = f"Scenario simulation calculated successfully: {res_dict.get('scenario')}."
        elif pricing_failed and inventory_failed:
            strategic_rec = "Inventory and Pricing analyses are currently unavailable due to sub-agent errors."
        elif pricing_failed:
            strategic_rec = f"{inventory_summary_text} Pricing analysis unavailable."
        elif inventory_failed:
            strategic_rec = f"Inventory analysis unavailable. {pricing_summary_text}"
        else:
            strategic_rec = (
                f"Actions required: {inventory_summary_text} "
                f"{pricing_summary_text}"
            )

        # Structure executive report JSON
        executive_summary = {
            "top_3_actions": top_actions,
            "inventory_risk_score": inventory_risk_score,
            "total_reorder_recommendations": len(reorder_recommendations),
            "total_dead_stock_items": len(dead_stock_alerts),
            "total_pricing_adjustments": len(pricing_recommendations),
            "estimated_profit_impact": estimated_profit_impact,
            "scenario_simulation": scenario_output,
            "strategic_recommendation": strategic_rec,
            "agent_telemetry": {
                "nodes_executed": list(task_graph_outputs.keys())
            }
        }
        
        return executive_summary
