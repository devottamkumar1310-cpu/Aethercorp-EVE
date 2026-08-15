# ==============================================================================
# PURPOSE: The single path from any external messaging channel into EVE's brain.
# DATA FLOW: Telegram/WhatsApp webhook -> resolved workspace link -> THIS service ->
#            existing AgentOrchestrator -> ExecutiveBoard/agents/recommendation traces
#            -> messaging-formatted reply.
# EXTENSION POINTS: Add a new channel by writing a webhook adapter that resolves a
#            ChannelLink and calls answer(); no business logic belongs in the adapter.
# ARCHITECTURAL DECISION:
# - There is exactly one AI brain. This service calls AgentOrchestrator.orchestrate(),
#   the same entry point /api/executive/chat uses, so inventory maths, forecasting,
#   agent prompts, workspace context, confidence governance and recommendation
#   traceability are shared rather than reimplemented per channel.
# - Chat surfaces get plain text with a hard length ceiling. The dashboard renders
#   rich structured agent_data; a messenger cannot, so formatting (and ONLY
#   formatting) differs between surfaces.
# ==============================================================================

import logging
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.services.ai.agent_orchestrator import AgentOrchestrator
from app.services.ai.prompt_injection_guard import PromptInjectionGuard
from app.services.audit_logger import AuditLogger

logger = logging.getLogger("eve.services.channels.eve_channel_service")

# Telegram caps a message at 4096 characters and WhatsApp at 4096 for body text.
# Staying under both keeps one formatter for every channel.
MAX_MESSAGE_CHARS = 3500

# Long enough for a real question, short enough that a pasted document cannot be
# smuggled in as "context" for the agent to treat as instructions.
MAX_QUESTION_CHARS = 1000

_INJECTION_REPLY = (
    "That message looks like it is trying to change how I work, so I have not run it. "
    "Ask me a question about your inventory, orders or stock instead."
)

_EMPTY_REPLY = "I did not catch a question there. Try /help to see what I can answer."


@dataclass(frozen=True)
class ChannelAnswer:
    """Result of running a channel question through EVE."""

    text: str
    # True when the question actually reached the agent board. False for guard
    # rejections and validation failures, which must not be billed or traced.
    reached_orchestrator: bool
    conversation_id: Optional[uuid.UUID] = None
    agent_data: Optional[Dict[str, Any]] = None


class EveChannelService:
    """Channel-agnostic bridge onto EVE's existing executive intelligence."""

    @staticmethod
    def validate_question(question: Optional[str]) -> Optional[str]:
        """
        Returns an error reply when the input is unusable, or None when it is safe
        to run. Kept separate from answer() so adapters can reject cheaply.
        """
        if not question or not question.strip():
            return _EMPTY_REPLY

        if len(question) > MAX_QUESTION_CHARS:
            return (
                "That message is too long for me to analyse over chat. "
                "Ask a shorter question, or use the EVE dashboard for detailed work."
            )

        # External messages are untrusted input. The same guard already protects
        # uploaded documents; reusing it keeps one definition of what an injection is.
        detected, reason = PromptInjectionGuard.detect(question)
        if detected:
            logger.warning("Blocked channel message: %s", reason)
            return _INJECTION_REPLY

        return None

    @classmethod
    async def answer(
        cls,
        db: Session,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        question: str,
        channel: str,
    ) -> ChannelAnswer:
        """
        Runs a founder's question through the existing EVE agent stack.

        Every answer is produced from that workspace's real data by the same
        orchestrator the dashboard uses. Nothing here invents business figures, and
        no fallback text is substituted for a real analysis — a failure says so.
        """
        rejection = cls.validate_question(question)
        if rejection is not None:
            return ChannelAnswer(text=rejection, reached_orchestrator=False)

        AuditLogger.log(
            db=db,
            event_type="channel_message_received",
            status="success",
            organization_id=organization_id,
            message=f"Inbound {channel} question routed to AgentOrchestrator",
            # The question body is deliberately omitted: audit rows are read by
            # operators and must not accumulate merchant business content.
            metadata_json={"channel": channel, "question_length": len(question)},
        )

        orchestrator = AgentOrchestrator()
        try:
            message = await orchestrator.orchestrate(
                db=db,
                org_id=organization_id,
                question=question.strip(),
                mode="smart",
                user_id=user_id,
                developer_mode=False,
                # Messaging answers are read on a phone. "baseline" runs the
                # deterministic inventory computation plus a single COO synthesis —
                # the same depth the post-upload proactive analysis uses — instead
                # of fanning out the full board for a one-line chat reply.
                depth="baseline",
            )
        except Exception as exc:
            logger.error(
                "Channel question failed for org=%s channel=%s: %s",
                organization_id,
                channel,
                exc,
                exc_info=True,
            )
            return ChannelAnswer(
                text=(
                    "I could not finish that analysis just now. Your data is unaffected — "
                    "try again in a moment, or open the EVE dashboard."
                ),
                reached_orchestrator=False,
            )

        return ChannelAnswer(
            text=cls.format_for_messaging(message.content),
            reached_orchestrator=True,
            conversation_id=message.conversation_id,
            agent_data=message.agent_data,
        )

    @staticmethod
    def format_for_messaging(text: str) -> str:
        """
        Renders EVE's executive answer as plain messenger text.

        The dashboard consumes the same content as structured markdown; here it is
        flattened because Telegram's and WhatsApp's markdown dialects disagree and a
        mis-parsed entity fails the whole send.
        """
        if not text:
            return _EMPTY_REPLY

        cleaned_lines = []
        for raw_line in text.splitlines():
            line = raw_line.rstrip()
            # Strip heading markers and bold/italic markup; keep the words.
            line = line.lstrip("#").strip() if line.lstrip().startswith("#") else line
            line = line.replace("**", "").replace("__", "")
            # Normalise list bullets to a single character that renders everywhere.
            stripped = line.lstrip()
            if stripped.startswith(("- ", "* ")):
                line = "• " + stripped[2:]
            cleaned_lines.append(line)

        result = "\n".join(cleaned_lines).strip()

        # Collapse runs of blank lines left behind by stripped markup.
        while "\n\n\n" in result:
            result = result.replace("\n\n\n", "\n\n")

        if len(result) > MAX_MESSAGE_CHARS:
            # Cut on a line boundary so a truncated answer never ends mid-figure,
            # which would read as a different (wrong) number.
            truncated = result[:MAX_MESSAGE_CHARS]
            last_break = truncated.rfind("\n")
            if last_break > MAX_MESSAGE_CHARS // 2:
                truncated = truncated[:last_break]
            result = truncated.rstrip() + "\n\n…continued in the EVE dashboard."

        return result or _EMPTY_REPLY
