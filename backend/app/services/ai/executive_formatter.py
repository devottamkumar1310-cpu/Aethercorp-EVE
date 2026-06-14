import re
import logging
from typing import List, Dict, Any, Optional
from app.schemas.executive import ExecutiveSynthesisResult, ExecutiveRecommendation, StrategicPriority

logger = logging.getLogger("eve.services.ai.executive_formatter")


class ExecutiveFormatter:
    @staticmethod
    def convert_technical_to_founder_language(text: str) -> str:
        """
        Rewrites database validation/hallucination checks into human-centric sentences.
        """
        if not text:
            return text

        # 1. Hallucination Warning replacements
        if "hallucination detected" in text.lower() or "claims could not be verified" in text.lower():
            return "I don't currently have enough verified data to support that conclusion."

        # 2. Data Sufficiency replacements
        if "data sufficiency failed" in text.lower() or "insufficient data" in text.lower() or "insufficient business data" in text.lower():
            # If forecast-related
            if "forecast" in text.lower() or "simulate" in text.lower():
                return "I need more sales history before I can generate a reliable forecast."
            return "I don't currently have enough verified data to support that conclusion."

        return text

    @staticmethod
    def build_assumptions(question: str) -> List[str]:
        """
        Generates deterministic assumptions for explainability based on the business domain.
        """
        q_lower = question.lower() if question else ""
        assumptions = []

        if any(kw in q_lower for kw in ["forecast", "scenario", "simulate", "what happens if"]):
            assumptions.extend([
                "Supplier fulfillment lead times will remain constant during the forecast horizon.",
                "Customer purchase habits will not experience sudden macroeconomic disruptions."
            ])
        if any(kw in q_lower for kw in ["price", "pricing", "discount", "margin", "cogs"]):
            assumptions.extend([
                "Price elasticity calculations assume competitor price indexes remain stable.",
                "Supplier costs (COGS) will not experience sudden supply-chain tariff shifts."
            ])
        if any(kw in q_lower for kw in ["inventory", "stock", "reorder", "dead stock", "sku"]):
            assumptions.extend([
                "Current inventory warehouse carrying costs remain stable at 15% per quarter.",
                "Standard shipping courier routes are operational without major port backlogs."
            ])
        if any(kw in q_lower for kw in ["client", "customer", "churn", "retention"]):
            assumptions.extend([
                "Contract definitions (e.g. Month-to-month contracts vs Multi-year) remain consistent.",
                "Past contract termination patterns are predictive of current churn risk vectors."
            ])

        # Default fallback
        if not assumptions:
            assumptions.append("Current historical transaction trend behaviors are assumed to continue over the next 30 days.")

        return assumptions

    @classmethod
    def build_executive_recommendation(
        cls,
        synthesis: ExecutiveSynthesisResult,
        question: str
    ) -> ExecutiveRecommendation:
        """
        Constructs the structured ExecutiveRecommendation Pydantic model.
        """
        evidence_list = []
        if synthesis.evidence_used:
            metrics = synthesis.evidence_used.get("metrics", {})
            for name, val in metrics.items():
                if val:
                    if isinstance(val, float) and val > 1000:
                        evidence_list.append(f"Ground truth {name}: ${val:,.2f}")
                    else:
                        evidence_list.append(f"Ground truth {name}: {val}")

            trends = synthesis.evidence_used.get("trends", {})
            for key, val in trends.items():
                if isinstance(val, str):
                    evidence_list.append(f"{key.replace('_', ' ').capitalize()}: {val.upper()}")

        if not evidence_list:
            evidence_list.append("Audited database KPIs and localized metrics.")

        confidence_score = synthesis.confidence_scores.get("Overall", 0.85)

        return ExecutiveRecommendation(
            recommendation=cls.convert_technical_to_founder_language(synthesis.summary),
            confidence=confidence_score,
            evidence=evidence_list[:5], # Keep top 5
            assumptions=cls.build_assumptions(question),
            expected_impact=synthesis.expected_impact or "Optimize business operations and margin structure.",
            # Let's support the raw fields to be used directly in formatting.
        )

    @classmethod
    def format_executive_response(
        cls,
        synthesis: ExecutiveSynthesisResult,
        question: str
    ) -> str:
        """
        Formats the final summary text to follow the 4-part Executive Communication order:
        1. What matters
        2. What action to take
        3. Expected impact
        4. Supporting evidence
        """
        # Clean the summary text first
        clean_summary = cls.convert_technical_to_founder_language(synthesis.summary)

        # Build list of action points
        priorities_text = ""
        if synthesis.priorities:
            priorities_text = "\n".join([
                f"- **{p.title}**: {p.description}" for p in synthesis.priorities
            ])
        else:
            priorities_text = "- No immediate manual actions required. Maintain current operational levels."

        # Expected impact
        clean_impact = cls.convert_technical_to_founder_language(synthesis.expected_impact)
        has_impact = False
        if clean_impact and clean_impact.strip() != "" and clean_impact.strip().upper() != "N/A":
            has_impact = True

        # Supporting evidence details
        rec_details = cls.build_executive_recommendation(synthesis, question)
        evidence_text = "\n".join([f"- {ev}" for ev in rec_details.evidence])
        
        # Format confidence category
        conf_category = getattr(synthesis, "confidence_category", "High Confidence") or "High Confidence"
        evidence_text += f"\n- Recommendation Confidence: {int(rec_details.confidence * 100)}% ({conf_category})"

        # Construct structured markdown output (conditionally omitting Expected Impact)
        formatted = (
            f"### 1. What Matters\n{clean_summary}\n\n"
            f"### 2. Action to Take\n{priorities_text}\n\n"
        )
        if has_impact:
            formatted += f"### 3. Expected Impact\n{clean_impact}\n\n"
        
        formatted += f"### 4. Supporting Evidence\n{evidence_text}"
        return formatted
