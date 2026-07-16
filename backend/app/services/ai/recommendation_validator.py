import logging

logger = logging.getLogger("eve.services.ai.recommendation_validator")

class RecommendationValidator:
    @staticmethod
    def validate(
        confidence_score: float,
        evidence_snapshot: dict,
        action: str,
        reasoning_chain: list,
        source_datasets: list,
        input_metrics: dict = None
    ) -> tuple[str, str]:
        """
        Validates the integrity of a recommendation trace.
        Returns (status: str, reason: str)
        status will be VALIDATED or REJECTED.
        """
        # 1. confidence between 0 and 1
        if not (0.0 <= confidence_score <= 1.0):
            return "REJECTED", f"Confidence score {confidence_score} is out of bounds (0-1)"

        # 2. evidence_snapshot exists
        if not evidence_snapshot:
            return "REJECTED", "Evidence snapshot is missing or empty"

        # 3. recommendation text exists
        if not action or len(action.strip()) == 0:
            return "REJECTED", "Recommendation text (action) is missing"

        # 4. reasoning exists
        if not reasoning_chain or len(reasoning_chain) == 0:
            return "REJECTED", "Reasoning chain is missing or empty"

        # 5. referenced metrics exist
        # Check if the metrics mentioned in input_metrics are present in evidence_snapshot
        if input_metrics:
            for k in input_metrics.keys():
                if k not in evidence_snapshot:
                    # In a production system, we might recursively search or do a deep check
                    # We'll log a warning and reject if it's strictly missing
                    return "REJECTED", f"Referenced metric '{k}' not found in evidence snapshot"

        # 6. recommendation does not contradict evidence
        # (Heuristic check: if confidence is 0, we reject it as a contradiction/hallucination)
        if confidence_score == 0.0:
            return "REJECTED", "Confidence score is 0, indicating possible contradiction or hallucination"

        return "VALIDATED", "All trace integrity checks passed"
