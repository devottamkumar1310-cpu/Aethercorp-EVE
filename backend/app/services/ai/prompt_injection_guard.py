import re
import unicodedata
import logging

logger = logging.getLogger("eve.services.ai.prompt_injection_guard")

# L33tspeak / character substitution normalization map
_LEET_MAP = str.maketrans({
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
    '!': 'i', '@': 'a', '$': 's', '+': 't', 'ı': 'i', 'İ': 'i'
})


def _normalize(text: str) -> str:
    """Normalize unicode and l33tspeak to ASCII for reliable pattern matching."""
    # NFKC: decomposes and recomposes unicode (catches lookalikes like Turkish dotless-i)
    normalized = unicodedata.normalize("NFKC", text)
    # Strip l33tspeak substitutions
    normalized = normalized.translate(_LEET_MAP)
    return normalized.lower()


class PromptInjectionGuard:
    # Ordered from highest signal to lowest
    INJECTION_PATTERNS = [
        # Direct system overrides
        r"ignore previous instructions",
        r"override system",
        r"disregard (your )?(previous |all )?instructions",
        r"forget (all |your |previous )?instructions",
        r"bypass rules",
        r"ignore your guidelines",
        r"new instructions",
        r"system message",

        # Persona / roleplay hijacking
        r"you are now",
        r"from now on (you|act|behave)",
        r"act as (if|a|an|the)",
        r"pretend (you are|to be|that)",
        r"without (any )?restrictions",
        r"no limitations",
        r"unrestricted mode",
        r"unfiltered (mode|advisor|ai)",

        # Confidence / recommendation manipulation
        r"change confidence",
        r"set confidence",
        r"output this recommendation",
        r"modify recommendation",
        r"(always|must) recommend",
        r"policy (requires|mandates|demands) (that )?you recommend",

        # Indirect policy/context poisoning
        r"context poisoning",
        r"disregard context",

        # Prompt completion attacks
        r"</?(system|instruction|prompt)>",
        r"\[system\]",
        r"\[override\]",
        r"\[ignore\]",
    ]

    _compiled = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]

    @classmethod
    def detect(cls, prompt: str) -> tuple[bool, str]:
        """
        Detects prompt injection attempts in user prompts or document-extracted text.
        Applies unicode normalization and l33tspeak normalization before scanning.
        Returns (is_detected: bool, reason: str)
        """
        if not prompt:
            return False, ""

        normalized = _normalize(prompt)

        for i, compiled_pattern in enumerate(cls._compiled):
            if compiled_pattern.search(normalized):
                matched_pattern = cls.INJECTION_PATTERNS[i]
                logger.warning(
                    f"Prompt injection detected | pattern='{matched_pattern}' | "
                    f"input_length={len(prompt)} | normalized_excerpt={normalized[:100]}"
                )
                return True, f"Suspicious instruction pattern detected: '{matched_pattern}'"

        return False, ""

    @classmethod
    def scan_document_content(cls, content: str) -> tuple[bool, str]:
        """
        Run injection detection against document-extracted content.
        Prefixes are stripped; only the content body is scanned.
        Returns (is_detected: bool, reason: str)
        """
        return cls.detect(content)
