# ==============================================================================
# PURPOSE: Cost Tracking Service.
# DATA FLOW: Calculates pricing using token usage and model coefficients.
# EXTENSION POINTS: Support complex custom fine-tuned model pricing rates.
# ==============================================================================

import logging
from typing import Dict

logger = logging.getLogger("eve.observability.cost_tracking")


class CostTracker:
    """
    Computes financial cost logs based on model token ingestion rates.
    """
    # Gemini 2.5/1.5 pricing coefficients per 1M tokens:
    # Input: $0.075 / 1,000,000
    # Output: $0.300 / 1,000,000
    INPUT_COST_PER_TOKEN = 0.000000075
    OUTPUT_COST_PER_TOKEN = 0.000000300

    _cost_store: Dict[str, float] = {}

    @classmethod
    def record_cost(cls, run_id: str, prompt_tokens: int, completion_tokens: int):
        """
        Calculates and logs the cost of a single model request.
        """
        cost = (prompt_tokens * cls.INPUT_COST_PER_TOKEN) + (completion_tokens * cls.OUTPUT_COST_PER_TOKEN)
        if run_id not in cls._cost_store:
            cls._cost_store[run_id] = 0.0
            
        cls._cost_store[run_id] += cost
        logger.debug(f"CostTracker [{run_id}]: Added ${cost:.6f} cost. Cumulative: ${cls._cost_store[run_id]:.6f}")

    @classmethod
    def get_run_cost(cls, run_id: str) -> float:
        """
        Retrieves total accumulated dollar cost for a specific run.
        """
        return round(cls._cost_store.get(run_id, 0.0), 6)
