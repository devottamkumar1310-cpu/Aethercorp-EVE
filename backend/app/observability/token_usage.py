# ==============================================================================
# PURPOSE: Token Usage tracker.
# DATA FLOW: Captures token counts from LLM responses, updating total session summaries.
# EXTENSION POINTS: Add warning triggers when token limits per minute are close to capacity.
# ==============================================================================

import logging
from typing import Dict

logger = logging.getLogger("eve.observability.token_usage")


class TokenTracker:
    """
    Accumulates and details prompt and completion tokens across agent invocations.
    """
    _usage_store: Dict[str, Dict[str, int]] = {}

    @classmethod
    def record_usage(cls, run_id: str, prompt_tokens: int, completion_tokens: int):
        """
        Appends usage token metrics to a running execution trace.
        """
        if run_id not in cls._usage_store:
            cls._usage_store[run_id] = {"prompt": 0, "completion": 0, "total": 0}
            
        cls._usage_store[run_id]["prompt"] += prompt_tokens
        cls._usage_store[run_id]["completion"] += completion_tokens
        cls._usage_store[run_id]["total"] += (prompt_tokens + completion_tokens)
        
        logger.debug(
            f"TokenTracker [{run_id}]: Added {prompt_tokens + completion_tokens} tokens. "
            f"Cumulative: {cls._usage_store[run_id]['total']}"
        )

    @classmethod
    def get_run_usage(cls, run_id: str) -> Dict[str, int]:
        """
        Retrieves total tokens used for a specific execution run.
        """
        return cls._usage_store.get(run_id, {"prompt": 0, "completion": 0, "total": 0})
