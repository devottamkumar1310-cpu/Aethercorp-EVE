# ==============================================================================
# PURPOSE: Verification, registration and handling of Shopify webhooks.
# DATA FLOW: Shopify -> POST /api/integrations/shopify/webhook -> HMAC verify ->
#            idempotency claim -> topic handler -> canonical EVE models.
# EXTENSION POINTS: Add a topic by extending TOPICS and handle_event().
# ARCHITECTURAL DECISION:
# - Only the topics that change numbers EVE reasons about are subscribed to.
#   Every extra topic is inbound traffic that must be authenticated, deduplicated
#   and processed, for data no agent reads.
# - Signature verification runs over the RAW request body. Re-serialising the
#   parsed JSON changes byte order and whitespace and would fail every signature.
# ==============================================================================

import base64
import datetime
import hashlib
import hmac
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.inventory import InventoryItem
from app.models.shopify import (
    ShopifyConnection,
    ShopifyProductMapping,
    ShopifyWebhookEvent,
)
from app.services.shopify.oauth_service import backend_public_url
from app.services.shopify.sync_service import ShopifySyncService, build_client

logger = logging.getLogger("eve.services.shopify.webhook_service")

# The minimum set that keeps EVE's inventory intelligence current.
TOPICS: List[str] = [
    "products/create",
    "products/update",
    "products/delete",
    "inventory_levels/update",
    "orders/create",
    "orders/updated",
    # Required by Shopify for any app handling customer data, and the correct
    # trigger for tearing down a connection when a merchant uninstalls.
    "app/uninstalled",
]


def webhook_endpoint() -> str:
    return f"{backend_public_url()}/api/integrations/shopify/webhook"


def verify_webhook_hmac(raw_body: bytes, supplied_hmac: Optional[str]) -> bool:
    """
    Verifies X-Shopify-Hmac-Sha256 over the raw body.

    Returns False rather than raising so the route can answer 401 uniformly.
    Uses compare_digest: a plain == on the digest is timing-distinguishable and
    would let an attacker recover a valid signature byte by byte.
    """
    if not supplied_hmac or not settings.SHOPIFY_API_SECRET:
        return False

    digest = hmac.new(
        settings.SHOPIFY_API_SECRET.encode("utf-8"), raw_body, hashlib.sha256
    ).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(expected, supplied_hmac)


class ShopifyWebhookService:
    # -------------------------------------------------------------- registration

    @classmethod
    async def register_all(
        cls, db: Session, connection: ShopifyConnection
    ) -> List[str]:
        """
        Subscribes the store to every topic EVE needs.

        Shopify rejects a duplicate subscription with 422; that is treated as
        success because the desired end state (a subscription exists) is met.
        """
        client = build_client(connection)
        address = webhook_endpoint()
        registered: List[str] = []

        for topic in TOPICS:
            try:
                response = await client.post(
                    "/webhooks.json",
                    {"webhook": {"topic": topic, "address": address, "format": "json"}},
                )
                webhook_id = str((response.get("webhook") or {}).get("id", ""))
                if webhook_id:
                    registered.append(webhook_id)
            except Exception as exc:
                # A failed subscription degrades freshness but must not fail the
                # whole connection — the scheduled/manual sync still works.
                logger.warning(
                    "Could not register Shopify webhook %s for %s: %s",
                    topic,
                    connection.shop_domain,
                    exc,
                )

        connection.webhook_ids = registered
        connection.updated_at = datetime.datetime.utcnow()
        db.commit()
        logger.info(
            "Registered %d/%d Shopify webhooks for %s.",
            len(registered),
            len(TOPICS),
            connection.shop_domain,
        )
        return registered

    @classmethod
    async def unregister_all(cls, connection: ShopifyConnection) -> None:
        """Best-effort webhook teardown on disconnect."""
        if not connection.webhook_ids:
            return
        try:
            client = build_client(connection)
        except Exception as exc:
            logger.warning("Cannot build client to unregister webhooks: %s", exc)
            return

        for webhook_id in connection.webhook_ids:
            try:
                await client.delete(f"/webhooks/{webhook_id}.json")
            except Exception as exc:
                # The token may already be revoked (uninstall). Local state is
                # still cleared by the caller, so this is not fatal.
                logger.info("Could not delete Shopify webhook %s: %s", webhook_id, exc)

    # ------------------------------------------------------------- idempotency

    @staticmethod
    def claim_event(
        db: Session,
        webhook_id: str,
        topic: str,
        shop_domain: Optional[str],
        organization_id: Optional[uuid.UUID],
    ) -> Optional[ShopifyWebhookEvent]:
        """
        Claims a delivery. Returns None when this webhook_id was already seen.

        The unique constraint arbitrates rather than a prior SELECT: Shopify can
        deliver the same event to two instances concurrently, and a read-then-write
        check would let both through.
        """
        event = ShopifyWebhookEvent(
            organization_id=organization_id,
            webhook_id=webhook_id,
            topic=topic,
            shop_domain=shop_domain,
            status="received",
            received_at=datetime.datetime.utcnow(),
        )
        db.add(event)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            logger.info("Duplicate Shopify webhook %s ignored.", webhook_id)
            return None
        db.refresh(event)
        return event

    @staticmethod
    def close_event(
        db: Session, event: ShopifyWebhookEvent, status: str, error: Optional[str] = None
    ) -> None:
        try:
            event.status = status
            event.error_message = error[:500] if error else None
            event.processed_at = datetime.datetime.utcnow()
            db.commit()
        except Exception as exc:  # pragma: no cover - bookkeeping only
            logger.warning("Failed to close Shopify webhook event: %s", exc)
            db.rollback()

    # ------------------------------------------------------------------ handlers

    @classmethod
    async def handle_event(
        cls,
        db: Session,
        connection: ShopifyConnection,
        topic: str,
        payload: Dict[str, Any],
    ) -> str:
        """
        Applies one webhook to EVE's models. Returns a short outcome label.

        Handlers are deliberately narrow — each writes through the same sync-service
        upsert paths as a full sync, so a webhook and a sync can never disagree
        about how a Shopify record becomes an EVE record.
        """
        if topic in ("products/create", "products/update"):
            ShopifySyncService.upsert_products(db, connection, [payload])
            return "product_upserted"

        if topic == "products/delete":
            # The Product row is retained: it is referenced by historical
            # SalesRecords and by recommendation traces, and deleting it would
            # rewrite past analyses. Only the external mapping is dropped, so the
            # product stops being refreshed from Shopify.
            product_id = str(payload.get("id", ""))
            if product_id:
                removed = (
                    db.query(ShopifyProductMapping)
                    .filter(
                        ShopifyProductMapping.organization_id == connection.organization_id,
                        ShopifyProductMapping.shopify_product_id == product_id,
                    )
                    .delete(synchronize_session=False)
                )
                db.commit()
                logger.info("Unmapped %d variant(s) for deleted Shopify product.", removed)
            return "product_unmapped"

        if topic == "inventory_levels/update":
            return cls._handle_inventory_level(db, connection, payload)

        if topic in ("orders/create", "orders/updated"):
            return await cls._handle_order(db, connection, payload)

        if topic == "app/uninstalled":
            # The token is already void at this point; mark the connection so the
            # UI shows "not connected" instead of failing every sync silently.
            connection.status = "disconnected"
            connection.sync_status = "idle"
            connection.webhook_ids = []
            connection.last_error = "The app was uninstalled from Shopify."
            connection.updated_at = datetime.datetime.utcnow()
            db.commit()
            logger.info("Shopify app uninstalled for %s.", connection.shop_domain)
            return "uninstalled"

        return "ignored"

    @staticmethod
    async def _handle_order(
        db: Session, connection: ShopifyConnection, payload: Dict[str, Any]
    ) -> str:
        """
        Applies an order webhook by restating the WHOLE day it belongs to.

        WHY NOT JUST WRITE THIS ORDER: SalesRecord is a daily aggregate per product
        and carries no per-order identity, so upsert_orders can only restate a
        (product, date) pair from a COMPLETE set of that day's orders. Handing it
        the single order in this webhook would overwrite the day with just that
        order — the second order of a day would erase the first, and the stored
        figure would converge on "the last order of the day" instead of the total.
        That silently understates sell-through, which feeds avg_daily_sales,
        forecasting and every reorder recommendation.

        So the day is re-fetched from Shopify (one extra API call) and restated from
        the full set, which is both correct and idempotent under redelivery.

        If the re-fetch fails, NOTHING is written. Stale sales are recoverable by
        the next sync; a corrupted day is not.
        """
        order_date = ShopifyWebhookService._order_date(payload)
        if order_date is None:
            logger.warning("Order webhook carried no usable created_at; skipping.")
            return "ignored"

        day_start = f"{order_date.isoformat()}T00:00:00Z"
        day_end = f"{(order_date + datetime.timedelta(days=1)).isoformat()}T00:00:00Z"

        try:
            client = build_client(connection)
            day_orders = await client.get_orders(
                created_at_min=day_start, created_at_max=day_end
            )
        except Exception as exc:
            # Deliberately not falling back to single-order restatement: that is
            # the corrupting path this method exists to avoid.
            logger.error(
                "Could not re-fetch %s orders for %s; leaving sales unchanged: %s",
                order_date,
                connection.shop_domain,
                exc,
            )
            return "deferred_to_sync"

        if not day_orders:
            # Shopify reported no orders for the day. Trust the webhook's own
            # payload only to the extent of the order it carried.
            day_orders = [payload]

        _, written = ShopifySyncService.upsert_orders(db, connection, day_orders)
        return f"order_day_restated:{written}"

    @staticmethod
    def _order_date(payload: Dict[str, Any]):
        """Extracts the order's calendar date (UTC). None when unparseable."""
        raw = payload.get("created_at") or ""
        if not raw:
            return None
        try:
            return datetime.datetime.fromisoformat(
                str(raw).replace("Z", "+00:00")
            ).date()
        except (ValueError, AttributeError):
            return None

    @staticmethod
    def _handle_inventory_level(
        db: Session, connection: ShopifyConnection, payload: Dict[str, Any]
    ) -> str:
        """
        Applies a single-location stock change.

        Shopify's inventory_levels/update payload carries one location's figure.
        EVE stores one total per product, so when a product is stocked at several
        locations the other locations' figures are not in this payload — writing
        this number alone would understate stock. In that case the product's levels
        are re-read in full during the next sync/reconcile instead of being
        overwritten with a partial number.
        """
        inventory_item_id = str(payload.get("inventory_item_id", ""))
        available = payload.get("available")
        if not inventory_item_id or available is None:
            return "ignored"

        mapping = (
            db.query(ShopifyProductMapping)
            .filter(
                ShopifyProductMapping.organization_id == connection.organization_id,
                ShopifyProductMapping.shopify_inventory_item_id == inventory_item_id,
            )
            .first()
        )
        if not mapping:
            return "unmapped"

        item = (
            db.query(InventoryItem)
            .filter(
                InventoryItem.organization_id == connection.organization_id,
                InventoryItem.product_id == mapping.product_id,
            )
            .first()
        )
        if not item:
            item = InventoryItem(
                id=uuid.uuid4(),
                organization_id=connection.organization_id,
                product_id=mapping.product_id,
                lead_time_days=14,
            )
            db.add(item)

        item.stock_on_hand = max(0, int(available))
        if not item.reorder_point:
            item.reorder_point = max(5, int(item.stock_on_hand * 0.1))
        db.commit()
        return "inventory_updated"

    @staticmethod
    def resolve_connection(
        db: Session, shop_domain: Optional[str]
    ) -> Optional[ShopifyConnection]:
        """
        Resolves the owning connection from the shop domain header.

        This is the tenant boundary for webhooks: the workspace comes from the
        stored connection, never from anything inside the payload, so a forged body
        cannot direct a write at another tenant. (The HMAC has already proved the
        request came from Shopify before this is reached.)
        """
        if not shop_domain:
            return None
        return (
            db.query(ShopifyConnection)
            .filter(ShopifyConnection.shop_domain == shop_domain.strip().lower())
            .first()
        )
