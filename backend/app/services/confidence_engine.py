import random

class ConfidenceEngine:
    @staticmethod
    def calculate_confidence(scenario_type: str, data_points: int = 100) -> int:
        """
        Generates a confidence score between 0 and 100 based on the simulation type and data availability.
        In a production environment, this would evaluate sales history length, margin variance, etc.
        """
        base_confidence = 85
        
        # Heuristics based on scenario type
        if scenario_type == "price_change":
            # Pricing elasticity is harder to predict accurately
            base_confidence -= 10
        elif scenario_type == "demand_growth":
            base_confidence -= 5
        elif scenario_type == "demand_decline":
            base_confidence -= 8
        elif scenario_type == "inventory_expansion":
            base_confidence += 5  # Straightforward capital calculation
        elif scenario_type == "cash_flow_forecast":
            base_confidence -= 2  # Forecasting always has some variance
            
        # Add some slight deterministic variance based on data_points just to make it realistic
        variance = (data_points % 5) - 2
        
        final_score = max(0, min(100, base_confidence + variance))
        return final_score
