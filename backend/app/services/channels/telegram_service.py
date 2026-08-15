# ==============================================================================
# PURPOSE: Telegram Bot API adapter. Transport only — no business logic.
# DATA FLOW: Telegram update -> parse -> command OR question ->
#            EveChannelService -> existing AgentOrchestrator -> send_message().
# EXTENSION POINTS: Add a command by extending COMMANDS and handle_command().
# ARCHITECTURAL DECISION:
# - This module knows about Telegram; it knows nothing about inventory. Everything
#   that produces a business answer goes through EveChannelService, which is the
#   same path the dashboard uses. That is what keeps one brain rather than two.
# ==============================================================================

import logging
from typing import Any, Dict, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.channel import CHANNEL_TELEGRAM
from app.services.channels.eve_channel_service import EveChannelService
from app.services.channels.link_service import ChannelLinkService

logger = logging.getLogger("eve.services.channels.telegram_service")

_SEND_TIMEOUT = 15.0
# Telegram's hard limit. EveChannelService already trims to 3500, so this is a
# backstop for command text rather than the primary control.
_TELEGRAM_MAX_CHARS = 4096

_HELP_TEXT = (
    "I'm EVE — I answer questions about your store using your real inventory data.\n\n"
    "Try asking:\n"
    "• Which products are at risk of stockout?\n"
    "• What inventory should I reorder?\n"
    "• Which products are dead stock?\n"
    "• How is my inventory performing?\n"
    "• What's the biggest problem in my store right now?\n\n"
    "Commands:\n"
    "/start — get started\n"
    "/connect <code> — link this chat to your EVE workspace\n"
    "/workspace — show the linked workspace\n"
    "/status — check the connection and last data sync\n"
    "/help — show this message"
)

_NOT_LINKED_TEXT = (
    "This chat isn't linked to an EVE workspace yet.\n\n"
    "Open EVE → Settings → Integrations, generate a Telegram link code, "
    "then send it here as:\n/connect YOUR-CODE"
)

_BILLING_INACTIVE_TEXT = (
    "This workspace's EVE subscription has ended.\n\n"
    "Reactivate billing in EVE → Settings → Billing to keep asking EVE "
    "questions here."
)


def is_configured() -> bool:
    """True when this deployment has a Telegram bot token."""
    return bool(settings.TELEGRAM_BOT_TOKEN)


def verify_secret_token(supplied: Optional[str]) -> bool:
    """
    Verifies the X-Telegram-Bot-Api-Secret-Token header.

    Telegram echoes back the secret registered with setWebhook, which is how the
    endpoint distinguishes real updates from anyone who guessed the URL. When no
    secret is configured the endpoint refuses everything rather than accepting
    unauthenticated updates — an open bot endpoint is an open door to the
    workspace-linking flow.
    """
    import hmac

    expected = settings.TELEGRAM_WEBHOOK_SECRET
    if not expected:
        return False
    return bool(supplied) and hmac.compare_digest(expected, supplied)


class TelegramService:
    # -------------------------------------------------------------- outbound

    @staticmethod
    async def send_message(chat_id: str, text: str) -> bool:
        """Sends a plain-text message. Returns False on failure rather than raising."""
        if not is_configured():
            logger.warning("Telegram send skipped: no bot token configured.")
            return False

        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text[:_TELEGRAM_MAX_CHARS],
            # No parse_mode: EVE's answers contain product names with characters
            # that Telegram's Markdown parser rejects, and a parse failure drops
            # the entire message rather than degrading its formatting.
            "disable_web_page_preview": True,
        }

        try:
            async with httpx.AsyncClient(timeout=_SEND_TIMEOUT) as http:
                response = await http.post(url, json=payload)
            if response.status_code >= 400:
                # The URL contains the bot token, so only the status is logged.
                logger.error("Telegram sendMessage failed: %s", response.status_code)
                return False
            return True
        except httpx.HTTPError as exc:
            logger.error("Telegram sendMessage network error: %s", exc)
            return False

    # --------------------------------------------------------------- parsing

    @staticmethod
    def extract_message(update: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Pulls the parts of a Telegram update EVE acts on.

        Only plain text messages are handled. Edits, channel posts, callbacks and
        media are ignored: acting on an edited message would re-answer a question
        the founder already had answered, and bill it again.
        """
        message = update.get("message")
        if not isinstance(message, dict):
            return None

        text = message.get("text")
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if not text or chat_id is None:
            return None

        sender = message.get("from") or {}
        return {
            "update_id": update.get("update_id"),
            "chat_id": str(chat_id),
            # The user id, not the chat id, is the identity: in a group the chat is
            # shared but authorisation belongs to the person who linked it.
            "user_id": str(sender.get("id", chat_id)),
            "text": text.strip(),
            "username": sender.get("username"),
        }

    @staticmethod
    def parse_command(text: str) -> Tuple[Optional[str], str]:
        """
        Splits a leading /command from its argument.

        Handles the /command@BotName form Telegram uses in groups.
        Returns (command_without_slash, remaining_text).
        """
        if not text.startswith("/"):
            return None, text

        parts = text[1:].split(maxsplit=1)
        if not parts:
            return None, ""
        command = parts[0].split("@", 1)[0].lower()
        return command, parts[1].strip() if len(parts) > 1 else ""

    # -------------------------------------------------------------- dispatch

    @classmethod
    async def handle_message(cls, db: Session, message: Dict[str, Any]) -> str:
        """
        Turns one inbound message into the reply text. Pure dispatch.
        """
        text = message["text"]
        external_id = message["user_id"]
        command, argument = cls.parse_command(text)

        link = ChannelLinkService.resolve_link(db, CHANNEL_TELEGRAM, external_id)

        if command == "connect":
            return cls._handle_connect(db, message, argument)

        if command in ("start", "help"):
            if link:
                return _HELP_TEXT
            return (
                "Welcome to EVE.\n\n" + _NOT_LINKED_TEXT
                if command == "start"
                else _HELP_TEXT + "\n\n" + _NOT_LINKED_TEXT
            )

        if not link:
            return _NOT_LINKED_TEXT

        # Re-checked on EVERY message: a workspace whose trial/subscription
        # lapses after Telegram was linked must lose access immediately, not
        # only the next time it tries to re-link.
        from app.core.plans import BillingRequired, PlanLimitExceeded, require_capability

        try:
            require_capability(db, link.organization_id, "telegram")
        except (PlanLimitExceeded, BillingRequired):
            return _BILLING_INACTIVE_TEXT

        if command == "workspace":
            return cls._describe_workspace(db, link.organization_id)

        if command == "status":
            return cls._describe_status(db, link.organization_id)

        if command:
            return f"I don't know the command /{command}. Send /help to see what I can do."

        # Not a command — a business question. This is the path into EVE's brain.
        ChannelLinkService.touch(db, link.link_id)
        answer = await EveChannelService.answer(
            db=db,
            organization_id=link.organization_id,
            user_id=link.user_id,
            question=text,
            channel=CHANNEL_TELEGRAM,
        )
        return answer.text

    @staticmethod
    def _handle_connect(db: Session, message: Dict[str, Any], argument: str) -> str:
        if not argument:
            return (
                "Send the link code with the command, e.g.\n/connect ABCD2345\n\n"
                "Generate one in EVE → Settings → Integrations."
            )

        username = message.get("username")
        link = ChannelLinkService.redeem_code(
            db=db,
            code=argument,
            channel=CHANNEL_TELEGRAM,
            external_id=message["user_id"],
            delivery_address=message["chat_id"],
            display_hint=f"@{username}" if username else None,
        )
        if not link:
            return (
                "That code is invalid or has expired. Generate a fresh one in "
                "EVE → Settings → Integrations and try again."
            )

        return (
            "Connected. This chat is now linked to your EVE workspace.\n\n"
            "Ask me anything about your business — try "
            '"Which products are at risk of stockout?"'
        )

    @staticmethod
    def _describe_workspace(db: Session, organization_id) -> str:
        from app.models.organization import Organization

        workspace = (
            db.query(Organization).filter(Organization.id == organization_id).first()
        )
        if not workspace:
            return "I can't find that workspace any more. Re-link with /connect."
        return f"Linked workspace: {workspace.name}"

    @staticmethod
    def _describe_status(db: Session, organization_id) -> str:
        """Reports the workspace's real data state — never a canned reassurance."""
        from app.models.shopify import ShopifyConnection

        connection = (
            db.query(ShopifyConnection)
            .filter(
                ShopifyConnection.organization_id == organization_id,
                ShopifyConnection.status == "connected",
            )
            .first()
        )

        lines = ["EVE status", "• Telegram: connected"]
        if connection:
            lines.append(f"• Shopify: connected ({connection.shop_domain})")
            if connection.last_successful_sync_at:
                lines.append(
                    "• Last successful sync: "
                    f"{connection.last_successful_sync_at:%Y-%m-%d %H:%M} UTC"
                )
            else:
                lines.append("• Last successful sync: none yet")
            lines.append(f"• Sync state: {connection.sync_status}")
        else:
            lines.append("• Shopify: not connected")

        return "\n".join(lines)
