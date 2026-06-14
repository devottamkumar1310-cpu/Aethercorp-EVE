import re
import logging
from typing import Optional
from app.schemas.executive import ExecutiveSynthesisResult, StrategicPriority
from app.services.localization.translator import LocalizationService

logger = logging.getLogger("eve.services.ai.conversation_layer")

# Deterministic regex patterns for intent routing
INTENT_PATTERNS = {
    "Technical Query": re.compile(
        r"\b(developer|technical|debug|agent scores|governance|hallucination|routing|diagnostics|telemetry|system logs|database|db|config|status|api|health|healthz|developer mode)\b",
        re.IGNORECASE
    ),
    "Forecast Query": re.compile(
        r"\b(forecast|prediction|projection|simulate|simulation|what happens if|demand drop|sales increase|demand decline|inventory expansion|future sales)\b",
        re.IGNORECASE
    ),
    "Inventory Query": re.compile(
        r"\b(inventory|stock|warehouse|sku|product|reorder|supplier|safety stock|overstock|dead stock|replenish|out of stock|stockout)\b",
        re.IGNORECASE
    ),
    "Pricing Query": re.compile(
        r"\b(price|pricing|discount|cost|markdown|retail price|margins|cogs|price change|value)\b",
        re.IGNORECASE
    ),
    "Finance Query": re.compile(
        r"\b(finance|revenue|expense|profit|budget|cash flow|cash|working capital|margin|balance sheet|income|loss|spend)\b",
        re.IGNORECASE
    ),
    "Executive Query": re.compile(
        r"\b(summary|brief|daily brief|health score|status|executive|ceo|coo|priorities|strategic|health of my business|risks|opportunities|priority)\b",
        re.IGNORECASE
    ),
    "Capability Discovery": re.compile(
        r"\b(what (do you do|can you do|are you capable of)|how (can you help|do you help)|who are you|tell me about yourself|what is your purpose|features|capabilities|what do you support)\b",
        re.IGNORECASE
    ),
    "Small Talk": re.compile(
        r"\b(how are you|how is it going|how's it going|what's up|how's life|are you okay|how are you doing|doing good|fine|all good)\b",
        re.IGNORECASE
    ),
    "Thanks": re.compile(
        r"\b(thanks|thank you|ty|thx|appreciate it|grateful|awesome thanks|cheers)\b",
        re.IGNORECASE
    ),
    "Goodbye": re.compile(
        r"\b(bye|goodbye|see you|talk later|exit|quit|farewell|cya)\b",
        re.IGNORECASE
    ),
    "Greeting": re.compile(
        r"\b(hi+|hello+|hey+|gday|g'day|good\s+morning|morning|afternoon|evening|hola|namaste+|yo|hey\s+there|hello\s+there)\b|नमस्ते",
        re.IGNORECASE
    )
}

STATIC_INTENTS = {"Greeting", "Small Talk", "Capability Discovery", "Thanks", "Goodbye"}


class ConversationLayer:
    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        """
        Computes the Levenshtein edit distance between two strings in pure Python.
        """
        if len(s1) < len(s2):
            return ConversationLayer.levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    @staticmethod
    def fuzzy_match_static_intent(question: str) -> Optional[str]:
        """
        Fuzzy matches static intents only (Greetings, Thanks, Goodbye) to prevent
        spillover to business-critical queries. Typos like 'namste', 'hllo', 'thx' match.
        """
        words = re.findall(r"\b\w+\b", question.lower())
        if not words:
            return None

        static_keywords = {
            "Greeting": ["hi", "hello", "hey", "namaste", "morning", "afternoon", "evening", "gday", "hola", "yo"],
            "Thanks": ["thanks", "thank", "ty", "thx", "appreciate", "grateful", "cheers"],
            "Goodbye": ["bye", "goodbye", "exit", "quit", "farewell", "cya"]
        }

        for word in words:
            # Skip very short words (<=2 chars) unless they are exact match to avoid false positives
            if len(word) <= 2:
                for intent, kws in static_keywords.items():
                    if word in kws:
                        return intent
                continue

            for intent, keywords in static_keywords.items():
                for kw in keywords:
                    # Determine typo tolerance threshold: 1 for short keywords, 2 for longer ones
                    threshold = 1 if len(kw) <= 4 else 2
                    if abs(len(word) - len(kw)) > threshold:
                        continue
                    if ConversationLayer.levenshtein_distance(word, kw) <= threshold:
                        return intent
        return None

    @staticmethod
    def classify_intent(question: str) -> str:
        """
        Deterministically classifies query intent using regex and fuzzy matching.
        Prioritizes business/technical intents over greetings/conversational inputs.
        Target Latency: <10ms.
        """
        if not question or not question.strip():
            return "Greeting"

        # Check in prioritized order to ensure correct routing
        priorities = [
            "Technical Query",
            "Forecast Query",
            "Inventory Query",
            "Pricing Query",
            "Finance Query",
            "Executive Query",
            "Capability Discovery",
            "Small Talk",
            "Thanks",
            "Goodbye",
            "Greeting"
        ]

        for intent in priorities:
            pattern = INTENT_PATTERNS[intent]
            if pattern.search(question):
                return intent

        # If regex didn't match, run fuzzy static intent matching for typo tolerance
        fuzzy_intent = ConversationLayer.fuzzy_match_static_intent(question)
        if fuzzy_intent:
            return fuzzy_intent

        # Fallback default
        return "Executive Query"

    @staticmethod
    def is_static_intent(intent: str) -> bool:
        """
        Checks if the intent is a basic conversational turn that can bypass the LLM.
        """
        return intent in STATIC_INTENTS

    @staticmethod
    def handle_static_intent(intent: str, lang: str = "en", question: Optional[str] = None) -> ExecutiveSynthesisResult:
        """
        Returns a localized static text block in an ExecutiveSynthesisResult.
        Bypasses multi-agent board completely for sub-100ms response times.
        """
        key_map = {
            "Greeting": "greeting",
            "Small Talk": "small_talk",
            "Capability Discovery": "capability",
            "Thanks": "thanks",
            "Goodbye": "goodbye"
        }
        
        if intent == "Greeting":
            summary_text = LocalizationService.get_greeting_by_query(question, lang)
        else:
            translation_key = key_map.get(intent, "greeting")
            summary_text = LocalizationService.get_static_translation(translation_key, lang)

        return ExecutiveSynthesisResult(
            agent="EVE Lead",
            summary=summary_text,
            priorities=[],
            expected_impact="N/A",
            findings_by_agent={},
            recommendations_by_agent={},
            confidence_scores={"Overall": 1.0},
            confidence_category="Executive Grade",
            risk_classification="Low Risk",
            detected_conflicts=[],
            evidence_used={},
            agent_contributors=["coo"],
            governance_decisions={
                "data_sufficiency": "FULL_DATA",
                "hallucination_free": True,
                "hallucination_violations": [],
                "confidence_level": 1.0,
                "confidence_category": "Executive Grade",
                "risk_level": "Low Risk",
                "conflicts_resolved": False
            }
        )
