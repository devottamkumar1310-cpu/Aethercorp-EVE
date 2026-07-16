import re
import logging

logger = logging.getLogger("eve.services.ai.prompt_injection_guard")

class PromptInjectionGuard:
    @staticmethod
    def detect(prompt: str) -> tuple[bool, str]:
        """
        Detects prompt injection attempts in user prompts.
        Returns (is_detected: bool, reason: str)
        """
        if not prompt:
            return False, ""

        prompt_lower = prompt.lower()
        
        # Heuristics for prompt injection
        suspicious_patterns = [
            r"ignore previous instructions",
            r"override system",
            r"change confidence",
            r"set confidence",
            r"pretend",
            r"act as",
            r"output this recommendation",
            r"modify recommendation",
            r"bypass rules",
            r"disregard context",
            r"forget all",
            r"new instructions",
            r"system message"
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, prompt_lower):
                logger.warning(f"Prompt injection detected using pattern: {pattern}")
                return True, f"Suspicious instruction pattern detected: '{pattern}'"

        return False, ""
