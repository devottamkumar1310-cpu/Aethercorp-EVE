# ==============================================================================
# PURPOSE: WhatsApp Business Cloud API (Meta Graph) adapter. Transport only.
# DATA FLOW: Meta webhook -> signature verify -> parse -> command OR question ->
#            EveChannelService -> existing AgentOrchestrator -> send_message().
# EXTENSION POINTS: Add interactive/button replies once Meta template approval exists.
# ARCHITECTURAL DECISION:
# - Identical dispatch shape to telegram_service.py, and identical business path:
#   both call EveChannelService. Nothing about inventory, forecasting or
#   recommendations is implemented here.
# - Meta's 24-hour customer service window means free-form replies are only allowed
#   within 24h of the founder's last message. EVE replies to inbound messages, so
#   the window is always open on the reply path; proactive alerts are best-effort
#   and documented as requiring an approved template for guaranteed delivery.
# ==============================================================================

import hashlib
import hmac
import logging
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.channel import CHANNEL_WHATSAPP
from app.services.channels.eve_channel_service import EveChannelService
from app.services.channels.link_service import ChannelLinkService
from app.services.channels.telegram_service import TelegramService

logger = logging.getLogger("eve.services.channels.whatsapp_service")

_SEND_TIMEOUT = 15.0
_WHATSAPP_MAX_CHARS = 4096

_HELP_TEXT = (
    "I'm EVE — I answer questions about your store using your real inventory data.\n\n"
    "Try asking:\n"
    "- Which products are at risk of stockout?\n"
    "- What inventory should I reorder?\n"
    "- Which products are dead stock?\n"
    "- How is my inventory performing?\n"
    "- What's the biggest problem in my store right now?\n\n"
    "Commands:\n"
    "/connect <code> - link this number to your EVE workspace\n"
    "/workspace - show the linked workspace\n"
    "/status - check the connection and last data sync\n"
    "/help - show this message"
)

_NOT_LINKED_TEXT = (
    "This number isn't linked to an EVE workspace yet.\n\n"
    "Open EVE -> Settings -> Integrations, generate a WhatsApp link code, "
    "then send it here as:\n/connect YOUR-CODE"
)

_PLAN_UPGRADE_REQUIRED_TEXT = (
    "WhatsApp access requires the Command plan or higher.\n\n"
    "Upgrade in EVE -> Settings -> Billing to keep asking EVE questions here."
)


def is_configured() -> bool:
    """True when this deployment has WhatsApp Cloud API credentials."""
    return bool(settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)


def verify_subscription(mode: Optional[str], token: Optional[str]) -> bool:
    """
    Validates Meta's GET webhook verification handshake.

    Meta calls the endpoint once with hub.mode=subscribe and the verify token that
    was entered in the App Dashboard; echoing hub.challenge completes setup.
    """
    if not settings.WHATSAPP_VERIFY_TOKEN:
        return False
    if mode != "subscribe" or not token:
        return False
    return hmac.compare_digest(settings.WHATSAPP_VERIFY_TOKEN, token)


def verify_signature(raw_body: bytes, header: Optional[str]) -> bool:
    """
    Verifies Meta's X-Hub-Signature-256 over the raw request body.

    Refuses when no app secret is configured: an unverified webhook would let
    anyone who found the URL drive the account-linking flow.
    """
    if not settings.WHATSAPP_APP_SECRET or not header:
        return False
    if not header.startswith("sha256="):
        return False

    expected = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header[len("sha256=") :])


class WhatsAppService:
    # -------------------------------------------------------------- outbound

    @staticmethod
    async def send_message(to_number: str, text: str) -> bool:
        """Sends a free-form text message via the Cloud API."""
        if not is_configured():
            logger.warning("WhatsApp send skipped: credentials not configured.")
            return False

        url = (
            f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}"
            f"/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        )
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_number,
            "type": "text",
            "text": {"preview_url": False, "body": text[:_WHATSAPP_MAX_CHARS]},
        }
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=_SEND_TIMEOUT) as http:
                response = await http.post(url, json=payload, headers=headers)
            if response.status_code >= 400:
                # Meta echoes the recipient number in error bodies, so only the
                # status code is logged.
                logger.error("WhatsApp send failed: %s", response.status_code)
                return False
            return True
        except httpx.HTTPError as exc:
            logger.error("WhatsApp send network error: %s", exc)
            return False

    # --------------------------------------------------------------- parsing

    @staticmethod
    def extract_messages(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Flattens Meta's nested webhook envelope into inbound text messages.

        A single delivery can carry several entries, each with several changes,
        each with several messages. Status callbacks (delivered/read receipts)
        appear in the same envelope and are skipped — they carry no question.
        """
        messages: List[Dict[str, Any]] = []

        for entry in payload.get("entry", []) or []:
            for change in entry.get("changes", []) or []:
                value = change.get("value") or {}
                for message in value.get("messages", []) or []:
                    if message.get("type") != "text":
                        continue
                    body = ((message.get("text") or {}).get("body") or "").strip()
                    sender = message.get("from")
                    message_id = message.get("id")
                    if not body or not sender or not message_id:
                        continue

                    messages.append(
                        {
                            "message_id": message_id,
                            # The sender's phone number in international format.
                            # Used as both identity and reply address.
                            "from_number": str(sender),
                            "text": body,
                        }
                    )

        return messages

    # -------------------------------------------------------------- dispatch

    @classmethod
    async def handle_message(cls, db: Session, message: Dict[str, Any]) -> str:
        """Turns one inbound WhatsApp message into the reply text."""
        text = message["text"]
        external_id = message["from_number"]
        # Command grammar is shared with Telegram so the two bots behave identically.
        command, argument = TelegramService.parse_command(text)

        link = ChannelLinkService.resolve_link(db, CHANNEL_WHATSAPP, external_id)

        if command == "connect":
            return cls._handle_connect(db, message, argument)

        if command in ("start", "help"):
            return _HELP_TEXT if link else _HELP_TEXT + "\n\n" + _NOT_LINKED_TEXT

        if not link:
            return _NOT_LINKED_TEXT

        # Re-checked on EVERY message, not only at link time: a workspace that
        # downgrades after linking WhatsApp must lose access immediately, not
        # whenever it next tries to re-link.
        from app.core.plans import BillingRequired, PlanLimitExceeded, require_capability

        try:
            require_capability(db, link.organization_id, "whatsapp")
        except (PlanLimitExceeded, BillingRequired):
            return _PLAN_UPGRADE_REQUIRED_TEXT

        if command == "workspace":
            return TelegramService._describe_workspace(db, link.organization_id)

        if command == "status":
            return TelegramService._describe_status(db, link.organization_id).replace(
                "Telegram: connected", "WhatsApp: connected"
            )

        if command:
            return f"I don't know the command /{command}. Send /help to see what I can do."

        ChannelLinkService.touch(db, link.link_id)
        answer = await EveChannelService.answer(
            db=db,
            organization_id=link.organization_id,
            user_id=link.user_id,
            question=text,
            channel=CHANNEL_WHATSAPP,
        )
        return answer.text

    @staticmethod
    def _handle_connect(db: Session, message: Dict[str, Any], argument: str) -> str:
        if not argument:
            return (
                "Send the link code with the command, e.g.\n/connect ABCD2345\n\n"
                "Generate one in EVE -> Settings -> Integrations."
            )

        number = message["from_number"]
        link = ChannelLinkService.redeem_code(
            db=db,
            code=argument,
            channel=CHANNEL_WHATSAPP,
            external_id=number,
            delivery_address=number,
            # Only the last four digits are stored for display; the full number
            # lives encrypted in delivery_address_encrypted.
            display_hint=f"…{number[-4:]}" if len(number) >= 4 else None,
        )
        if not link:
            return (
                "That code is invalid or has expired. Generate a fresh one in "
                "EVE -> Settings -> Integrations and try again."
            )

        return (
            "Connected. This number is now linked to your EVE workspace.\n\n"
            "Ask me anything about your business - try "
            '"Which products are at risk of stockout?"'
        )
