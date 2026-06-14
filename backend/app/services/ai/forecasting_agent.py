import re
import uuid
import logging
from sqlalchemy.orm import Session
from app.services.simulation_engine import SimulationEngine
from app.services.confidence_engine import ConfidenceEngine
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

logger = logging.getLogger("eve.services.ai.forecasting_agent")

class ForecastingAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str = ""
    ) -> AgentAnalysisResult:
        q_lower = question.lower()
        
        # 1. Parse request parameters and execute deterministic math
        scenario_type = "cash_flow_forecast"
        parameter_val = 30.0
        
        if "price" in q_lower or "pricing" in q_lower:
            match = re.search(r'(\d+)', q_lower)
            parameter_val = float(match.group(1)) if match else 10.0
            scenario_type = "price_change"
            sim_data = SimulationEngine.simulate_price_change(parameter_val, org_id, db)
            
        elif "sales" in q_lower or "demand" in q_lower:
            match = re.search(r'(\d+)', q_lower)
            parameter_val = float(match.group(1)) if match else 20.0
            if "drop" in q_lower or "fall" in q_lower or "decline" in q_lower or "down" in q_lower or "decrease" in q_lower or "falls" in q_lower or "drops" in q_lower:
                scenario_type = "demand_decline"
                sim_data = SimulationEngine.simulate_demand_decline(parameter_val, org_id, db)
            else:
                scenario_type = "demand_growth"
                sim_data = SimulationEngine.simulate_demand_growth(parameter_val, org_id, db)
                
        elif "expand" in q_lower or "expansion" in q_lower or "increase inventory" in q_lower or "order" in q_lower:
            match = re.search(r'(\d+)', q_lower)
            parameter_val = float(match.group(1)) if match else 1000.0
            scenario_type = "inventory_expansion"
            sim_data = SimulationEngine.simulate_inventory_expansion(int(parameter_val), org_id, db)
            
        else:
            match = re.search(r'(\d+)', q_lower)
            parameter_val = float(match.group(1)) if match else 30.0
            scenario_type = "cash_flow_forecast"
            sim_data = SimulationEngine.simulate_cash_flow_forecast(int(parameter_val), org_id, db)

        # 2. Compute confidence deterministically
        confidence = ConfidenceEngine.calculate_deterministic_confidence(scenario_type, db, org_id)

        # 3. Construct LLM prompt wrapping deterministic calculations
        prompt = f"""
        User Question/Scenario: {question}
        
        The deterministic Python Simulation Engine has run this forecast:
        - Scenario: {sim_data.get('scenario')}
        - Parameter: {sim_data.get('parameter')}
        - Calculations:
          * Expected Profit Change: {sim_data.get('expected_profit_change', 'N/A')}
          * Required Capital: ${sim_data.get('required_capital', 0.0):,.2f}
          * Available Capital: ${sim_data.get('available_capital', 0.0):,.2f}
          * Capital Gap: ${sim_data.get('capital_gap', 0.0):,.2f}
          * Inventory/Volume Impact: {sim_data.get('inventory_impact') or sim_data.get('new_stockout_dates') or sim_data.get('dead_stock_risk') or 'N/A'}
        - Assumptions Used: {sim_data.get('assumptions')}
        - Deterministic Confidence Score: {confidence}

        CRITICAL BUSINESS SAFEGUARD: Do not alter, modify, or perform calculations on these values. All numbers are computed deterministically.
        Your job is to explain the operational tradeoffs (e.g. profit gains vs capital gap or margin vs volume drop) clearly to the CEO.
        """

        system_instruction = (
            "You are EVE's Forecasting & Scenario Explainer Agent. Explain computed forecast tradeoffs "
            "clearly and concisely. Do not compute or invent any numbers."
        )

        try:
            result: AgentAnalysisResult = await self.gemini_service.generate_structured_response(
                prompt=prompt,
                response_schema=AgentAnalysisResult,
                system_instruction=system_instruction,
                agent_name="forecasting"
            )
            result.confidence = confidence
            return result
        except Exception as e:
            logger.warning(f"Forecasting Agent LLM analysis failed: {e}. Falling back to deterministic analysis.")
            summary = (
                f"Forecasting Fallback: Executed deterministic simulation for scenario '{sim_data.get('scenario')}' "
                f"with parameter {parameter_val}. Expected Profit Impact: ${sim_data.get('expected_profit_change', 0.0):,.2f}, "
                f"required capital: ${sim_data.get('required_capital', 0.0):,.2f}, available capital: ${sim_data.get('available_capital', 0.0):,.2f}, "
                f"capital gap: ${sim_data.get('capital_gap', 0.0):,.2f}."
            )
            findings = [
                f"Profit Impact: ${sim_data.get('expected_profit_change', 0.0):,.2f}",
                f"Capital Required: ${sim_data.get('required_capital', 0.0):,.2f}",
                f"Capital Gap: ${sim_data.get('capital_gap', 0.0):,.2f}"
            ]
            recommendations = [
                "Maintain a capital buffer to cover potential gaps.",
                "Optimize operational efficiency to mitigate volume/price changes."
            ]
            return AgentAnalysisResult(
                agent="Forecasting Agent",
                summary=summary,
                findings=findings,
                recommendations=recommendations,
                confidence=confidence
            )
