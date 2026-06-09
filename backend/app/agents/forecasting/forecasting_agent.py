import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent
from app.core.agent_registry import register_agent
from app.services.simulation_engine import SimulationEngine

logger = logging.getLogger("eve.agents.forecasting.forecasting_agent")

@register_agent(
    role="forecasting",
    name="Executive Forecasting Agent",
    description="Runs deterministic business simulations and translates them into executive action plans.",
    tools=[],
    capabilities=["scenario_simulation", "cash_flow_forecasting", "demand_modeling", "executive_advice"],
    supported_tasks=["simulate_price_change", "simulate_demand_growth", "simulate_demand_decline", "forecast_cash_flow"]
)
class ForecastingAgent(BaseAgent):
    role: str = "forecasting"
    name: str = "Executive Forecasting Agent"
    system_prompt: str = (
        "You are the Executive Forecasting Agent of EVE. Your goal is to explain complex business simulations "
        "and cash flow forecasts to the founder.\n\n"
        "Instructions:\n"
        "1. You will be provided with exact, deterministic math calculated by the Simulation Engine.\n"
        "2. Do not invent, alter, or recalculate these numbers.\n"
        "3. Act as the Executive Reasoning layer: explain the tradeoffs (e.g. margin increase vs volume drop) "
        "and summarize the simulation concisely."
    )
    tools = []

    def __init__(self, db: Optional[Session] = None):
        super().__init__(db=db)

    async def run(
        self,
        task_description: str,
        organization_id: int,
        context: Optional[Dict[str, Any]] = None
    ) -> "AgentResponseSchema": # type: ignore
        
        scenario_type = context.get("scenario_type") if context else None
        parameter = context.get("parameter") if context else 0.0
        
        # 1. Execute Deterministic Simulation
        simulation_result = {}
        if scenario_type == "price_change":
            simulation_result = SimulationEngine.simulate_price_change(parameter, organization_id, self.db)
        elif scenario_type == "demand_growth":
            simulation_result = SimulationEngine.simulate_demand_growth(parameter, organization_id, self.db)
        elif scenario_type == "demand_decline":
            simulation_result = SimulationEngine.simulate_demand_decline(parameter, organization_id, self.db)
        elif scenario_type == "inventory_expansion":
            simulation_result = SimulationEngine.simulate_inventory_expansion(int(parameter), organization_id, self.db)
        elif scenario_type == "cash_flow_forecast":
            simulation_result = SimulationEngine.simulate_cash_flow_forecast(int(parameter), organization_id, self.db)

        # 2. Augment Prompt with hard math
        augmented_prompt = (
            f"The deterministic Python Simulation Engine has run the scenario '{scenario_type}' with parameter {parameter}.\n"
            f"Here are the exact computed results and confidence scores:\n"
            f"{simulation_result}\n\n"
            f"User Question/Context: {task_description}\n\n"
            "CRITICAL REQUIREMENT: Do not calculate any numbers. Just explain the operational tradeoffs of this simulation output."
        )
        
        logger.info(f"--- FORECASTING GEMINI PROMPT ---\n{augmented_prompt}\n-----------------------------")
        
        response = await super().run(
            task_description=augmented_prompt, 
            organization_id=organization_id, 
            context=context
        )
        
        # Inject deterministic calculations into the LLM result for the Orchestrator
        if isinstance(response.result, dict):
            response.result.update(simulation_result)
            
        return response
