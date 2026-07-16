import logging

logger = logging.getLogger("eve.services.ai.recommendation_evidence_validator")


class RecommendationEvidenceValidator:
    """
    Validates whether the evidence snapshot and input metrics sufficiently support
    a given recommendation action.  Used as Task 3 of the Decision Traceability
    Phase 2 hardening pipeline.
    """

    # Keyword groups that signal what kind of evidence should be present
    INVENTORY_KEYWORDS = ["reorder", "stock", "inventory", "sku", "units", "stockout", "warehouse"]
    FINANCE_KEYWORDS = ["price", "margin", "revenue", "cost", "profit", "expense", "invoice", "discount"]
    GROWTH_KEYWORDS = ["grow", "expand", "market", "invest", "campaign", "opportunity"]
    CLIENT_KEYWORDS = ["client", "customer", "churn", "retention", "inactive"]

    @staticmethod
    def validate(
        action: str,
        evidence_snapshot: dict,
        input_metrics: dict = None,
    ) -> tuple[str, str]:
        """
        Evaluate whether the evidence snapshot (and optional input_metrics) adequately
        support the recommendation described by *action*.

        Returns
        -------
        (evidence_validation_status, reason)
            status is one of: SUPPORTED, PARTIALLY_SUPPORTED, UNSUPPORTED
        """
        # Guard: absolutely nothing provided
        if not evidence_snapshot and input_metrics is None:
            return "UNSUPPORTED", "No evidence provided for this recommendation"

        # Merge both evidence sources into a single flat dict for analysis.
        # evidence_snapshot takes precedence when keys collide.
        combined_evidence: dict = {}
        if input_metrics:
            combined_evidence.update(input_metrics)
        if evidence_snapshot:
            combined_evidence.update(evidence_snapshot)

        if len(combined_evidence) == 0:
            return "UNSUPPORTED", "No evidence provided for this recommendation"

        # Count how many keywords from the action text appear as keys in combined_evidence
        action_lower = (action or "").lower()
        all_keywords = (
            RecommendationEvidenceValidator.INVENTORY_KEYWORDS
            + RecommendationEvidenceValidator.FINANCE_KEYWORDS
            + RecommendationEvidenceValidator.GROWTH_KEYWORDS
            + RecommendationEvidenceValidator.CLIENT_KEYWORDS
        )

        evidence_keys_lower = {k.lower() for k in combined_evidence.keys()}
        match_count = sum(
            1 for kw in all_keywords
            if kw in action_lower and kw in evidence_keys_lower
        )

        logger.debug(
            "EvidenceValidator: action=%r match_count=%d evidence_keys=%d",
            action[:80],
            match_count,
            len(combined_evidence),
        )

        # Decision rules (order matters — stronger conditions first)
        if match_count >= 2 or len(combined_evidence) >= 3:
            return "SUPPORTED", "Evidence directly supports recommendation"

        if match_count == 1 or 1 <= len(combined_evidence) <= 2:
            return "PARTIALLY_SUPPORTED", "Limited evidence available; partial support only"

        return "UNSUPPORTED", "No relevant evidence keys found in snapshot"
