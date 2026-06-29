import re
from typing import Dict, Any, List, Set


class AIValidationService:
    @staticmethod
    def validate_response(text: str, retrieved_data_keys: List[str]) -> Dict[str, Any]:
        """
        Validates an AI response for:
        1. Fact vs interpretation separation.
        2. Citation matching against retrieved DB keys.
        3. Rejecting references to missing/unavailable keys.
        4. Confidence classification.
        """
        # Convert keys to lowercase for robust match checks
        retrieved_set: Set[str] = {k.lower() for k in retrieved_data_keys}
        
        # 1. Distinguish metric references (e.g. $1000, 50 units, 15 days)
        # Match dollar values, percentages, or integers followed by operational units
        metric_pattern = re.compile(r"(\$\d+(?:,\d+)*(?:\.\d+)?|\d+%\s*|\b\d+\s*(?:units|days|items|sku|records)\b)", re.IGNORECASE)
        metrics_found = metric_pattern.findall(text)

        # 2. Check for missing/unretrieved entities
        # E.g. "Item #123" where "123" is not in retrieved_data_keys
        entity_pattern = re.compile(r"(?:\b(?:item|sku|supplier|id)\b\s*#?|#)([a-z0-9_-]+)", re.IGNORECASE)
        entities_found = entity_pattern.findall(text)

        rejected = False
        rejection_reason = None
        for entity in entities_found:
            entity_lower = entity.lower()
            # If the response mentions an entity identifier not present in the retrieved DB context:
            if retrieved_set and not any(entity_lower in k for k in retrieved_set):
                rejected = True
                rejection_reason = f"Response references unavailable database entity ID '{entity}'."
                break

        # 3. Citation Check
        # Enforce that if metrics are present, at least one retrieved key citation is mentioned
        has_citations = any(k.lower() in text.lower() for k in retrieved_data_keys)
        citations_required = len(metrics_found) > 0

        # 4. Classification logic
        if rejected:
            classification = "Insufficient Data"
        elif not retrieved_data_keys:
            classification = "Insufficient Data"
        elif citations_required and not has_citations:
            classification = "Partially Verified"
        elif len(metrics_found) > 0 and has_citations:
            classification = "Verified"
        else:
            classification = "AI Generated"

        # Separate facts from interpretations
        sentences = [s.strip() for s in re.split(r"[.!?]", text) if s.strip()]
        facts = []
        interpretations = []

        for s in sentences:
            if metric_pattern.search(s) or any(k.lower() in s.lower() for k in retrieved_data_keys):
                facts.append(s)
            else:
                interpretations.append(s)

        return {
            "valid": not rejected,
            "rejection_reason": rejection_reason,
            "confidence_classification": classification,
            "metrics_found": metrics_found,
            "citations_found": [k for k in retrieved_data_keys if k.lower() in text.lower()],
            "facts": facts,
            "interpretations": interpretations
        }
