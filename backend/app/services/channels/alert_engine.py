# ==============================================================================
# PURPOSE: Turns EVE's EXISTING recommendations into proactive channel alerts.
# DATA FLOW: RecommendationTrace (written by the agent board) -> AnalyticsService
#            dashboard metrics -> alert lines -> linked Telegram/WhatsApp accounts.
# EXTENSION POINTS: Add an alert type by adding a builder that reads an existing
#            recommendation_type. Do not add a new analysis here.
# ARCHITECTURAL DECISION:
# - This is a DISPATCHER, not a second intelligence. Every figure it sends was
#   already computed by the agent board and stored in a RecommendationTrace, so an
#   alert can never disagree with what the dashboard shows for the same workspace.
#   Recomputing stockout risk here would create exactly the divergence EVE's
#   single-source-of-truth design exists to prevent.
# - Alerts are only ever delivered to accounts that completed the link flow for
#   that workspace, so a dispatch cannot leak one tenant's figures to another.
# ==============================================================================

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.crypto import decrypt
from app.models.channel import CHANNEL_TELEGRAM, CHANNEL_WHATSAPP, ChannelLink

logger = logging.getLogger("eve.services.channels.alert_engine")

# Only surface a stockout that is close enough to act on. Beyond this the founder
# has time to react through the normal weekly review, and a daily ping about it
# trains them to ignore the channel.
STOCKOUT_ALERT_DAYS = 14

# Bounded so one very unhealthy catalogue cannot produce a wall of text.
MAX_ITEMS_PER_ALERT = 5


@dataclass
class Alert:
    """One proactive message, traceable back to the recommendations behind it."""

    alert_type: str
    title: str
    body: str
    # SKUs referenced, so a founder can follow the alert to the same
    # recommendation in the dashboard's traceability view.
    related_skus: List[str] = field(default_factory=list)

    def render(self) -> str:
        return f"{self.title}\n\n{self.body}" if self.body else self.title


class AlertEngine:
    @staticmethod
    def build_alerts(db: Session, organization_id: uuid.UUID) -> List[Alert]:
        """
        Derives alerts from the workspace's existing recommendations.

        Returns an empty list when there is nothing worth interrupting the founder
        about. Silence is a valid result: inventing an alert to look active would
        be the fastest way to make the channel worthless.
        """
        from app.services.analytics_service import AnalyticsService

        try:
            metrics = AnalyticsService.get_dashboard_metrics(db, organization_id)
        except Exception as exc:
            # A metrics failure must not fabricate an alert. Log and stay silent.
            logger.error(
                "Alert generation skipped for org %s: %s", organization_id, exc
            )
            return []

        alerts: List[Alert] = []

        stockouts = [
            item
            for item in metrics.get("stockout_predictions", []) or []
            if 0 < float(item.get("days_until_stockout") or 0) <= STOCKOUT_ALERT_DAYS
        ]
        if stockouts:
            alerts.append(AlertEngine._build_stockout_alert(stockouts))

        reorders = metrics.get("reorder_recommendations", []) or []
        if reorders:
            alerts.append(AlertEngine._build_reorder_alert(reorders))

        dead_stock = metrics.get("dead_stock_items", []) or []
        if dead_stock:
            alerts.append(AlertEngine._build_dead_stock_alert(dead_stock))

        return alerts

    # ------------------------------------------------------------- builders

    @staticmethod
    def _build_stockout_alert(items: List[Dict[str, Any]]) -> Alert:
        ordered = sorted(
            items, key=lambda item: float(item.get("days_until_stockout") or 0)
        )
        shown = ordered[:MAX_ITEMS_PER_ALERT]

        lines = []
        for item in shown:
            days = int(round(float(item.get("days_until_stockout") or 0)))
            name = item.get("name") or item.get("sku") or "Unknown product"
            day_word = "day" if days == 1 else "days"
            line = f"• {name} — projected to stock out in {days} {day_word}"
            revenue_at_risk = float(item.get("estimated_revenue_at_risk") or 0.0)
            if revenue_at_risk > 0:
                line += f" (≈{revenue_at_risk:,.0f} at risk)"
            lines.append(line)

        if len(ordered) > len(shown):
            lines.append(f"…and {len(ordered) - len(shown)} more.")

        title = (
            f"Stockout risk: {len(ordered)} "
            f"{'SKU needs' if len(ordered) == 1 else 'SKUs need'} attention"
        )
        return Alert(
            alert_type="stockout_risk",
            title=title,
            body="\n".join(lines),
            related_skus=[str(item.get("sku")) for item in shown if item.get("sku")],
        )

    @staticmethod
    def _build_reorder_alert(items: List[Dict[str, Any]]) -> Alert:
        shown = items[:MAX_ITEMS_PER_ALERT]
        lines = []
        for item in shown:
            name = item.get("name") or item.get("sku") or "Unknown product"
            quantity = int(item.get("recommended_reorder") or 0)
            if quantity > 0:
                lines.append(f"• {name} — reorder {quantity} units")
            else:
                lines.append(f"• {name} — reorder recommended")

        if len(items) > len(shown):
            lines.append(f"…and {len(items) - len(shown)} more.")

        title = (
            f"{len(items)} {'SKU requires' if len(items) == 1 else 'SKUs require'} "
            "reorder attention"
        )
        return Alert(
            alert_type="reorder",
            title=title,
            body="\n".join(lines),
            related_skus=[str(item.get("sku")) for item in shown if item.get("sku")],
        )

    @staticmethod
    def _build_dead_stock_alert(items: List[Dict[str, Any]]) -> Alert:
        shown = items[:MAX_ITEMS_PER_ALERT]
        total_value = sum(float(item.get("estimated_value") or 0.0) for item in items)

        lines = []
        for item in shown:
            name = item.get("name") or item.get("sku") or "Unknown product"
            value = float(item.get("estimated_value") or 0.0)
            units = int(item.get("stock_on_hand") or 0)
            if value > 0:
                lines.append(f"• {name} — {units} units, ≈{value:,.0f} tied up")
            else:
                lines.append(f"• {name} — {units} units")

        if len(items) > len(shown):
            lines.append(f"…and {len(items) - len(shown)} more.")

        title = f"Dead stock: {len(items)} {'SKU' if len(items) == 1 else 'SKUs'}"
        if total_value > 0:
            title += f", ≈{total_value:,.0f} in working capital"

        return Alert(
            alert_type="dead_stock",
            title=title,
            body="\n".join(lines),
            related_skus=[str(item.get("sku")) for item in shown if item.get("sku")],
        )

    # ------------------------------------------------------------ dispatch

    @staticmethod
    async def dispatch(
        db: Session,
        organization_id: uuid.UUID,
        alerts: Optional[List[Alert]] = None,
    ) -> Dict[str, Any]:
        """
        Sends alerts to every account linked to this workspace.

        Delivery is per-link and best-effort: one channel failing must not stop the
        other, because the founder may only be reachable on one of them.
        """
        from app.services.channels.telegram_service import TelegramService
        from app.services.channels.whatsapp_service import WhatsAppService

        if alerts is None:
            alerts = AlertEngine.build_alerts(db, organization_id)

        if not alerts:
            return {"alerts": 0, "delivered": 0, "failed": 0}

        links = (
            db.query(ChannelLink)
            .filter(
                ChannelLink.organization_id == organization_id,
                ChannelLink.status == "active",
            )
            .all()
        )
        if not links:
            return {"alerts": len(alerts), "delivered": 0, "failed": 0}

        message = "EVE alert\n\n" + "\n\n".join(alert.render() for alert in alerts)

        delivered = 0
        failed = 0
        for link in links:
            try:
                address = decrypt(link.delivery_address_encrypted)
            except Exception:
                logger.error("Skipping alert for link %s: undecryptable address.", link.id)
                failed += 1
                continue

            try:
                if link.channel == CHANNEL_TELEGRAM:
                    sent = await TelegramService.send_message(address, message)
                elif link.channel == CHANNEL_WHATSAPP:
                    # Meta only permits free-form sends inside the 24-hour customer
                    # service window; outside it this returns False and the alert is
                    # reported as failed rather than silently assumed delivered.
                    sent = await WhatsAppService.send_message(address, message)
                else:
                    sent = False

                if sent:
                    delivered += 1
                else:
                    failed += 1
            except Exception as exc:
                logger.error("Alert dispatch failed on %s: %s", link.channel, exc)
                failed += 1

        logger.info(
            "Dispatched %d alert(s) for org %s: %d delivered, %d failed.",
            len(alerts),
            organization_id,
            delivered,
            failed,
        )
        return {"alerts": len(alerts), "delivered": delivered, "failed": failed}
