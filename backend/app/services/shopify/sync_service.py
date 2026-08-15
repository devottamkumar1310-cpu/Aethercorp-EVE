# ==============================================================================
# PURPOSE: Synchronises a connected Shopify store into EVE's canonical models.
# DATA FLOW: ShopifyAdminClient -> existing ShopifyMapper -> Product / InventoryItem /
#            SalesRecord, with ShopifyProductMapping recording external identity.
# EXTENSION POINTS: Add locations/fulfilment if EVE starts reasoning per-warehouse.
# ARCHITECTURAL DECISION:
# - Maps onto the EXISTING canonical models. Shopify data becomes ordinary EVE
#   Products, InventoryItems and SalesRecords, so every agent, forecast and
#   recommendation works on it with no Shopify-specific branch anywhere.
# - Reuses app/services/shopify_mapper.py rather than reimplementing the field
#   translation, which already handles variant/size/colour classification and
#   refund netting.
# - Only the three resources EVE reasons about are imported: products/variants,
#   inventory levels and order line items. Customer records, addresses, payment
#   details and fulfilment data are never fetched — EVE has no use for them and
#   holding them would expand the breach surface for no product benefit.
# ==============================================================================

import datetime
import logging
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app.core.crypto import decrypt
from app.core.plans import enforce_sku_limit
from app.models.inventory import InventoryItem, SalesRecord
from app.models.product import Product
from app.models.shopify import (
    ShopifyConnection,
    ShopifyProductMapping,
    ShopifySyncJob,
)
from app.services.shopify.client import (
    ShopifyAdminClient,
    ShopifyAPIError,
    ShopifyAuthError,
)
from app.services.shopify_mapper import (
    ShopifyOrderMapper,
    ShopifyProductMapper,
)

logger = logging.getLogger("eve.services.shopify.sync_service")


def build_client(connection: ShopifyConnection) -> ShopifyAdminClient:
    """Constructs an API client from a stored connection, decrypting the token."""
    return ShopifyAdminClient(
        shop_domain=connection.shop_domain,
        access_token=decrypt(connection.access_token_encrypted),
        api_version=connection.api_version or settings.SHOPIFY_API_VERSION,
    )


class ShopifySyncService:
    """Idempotent synchronisation of Shopify data into EVE."""

    # ------------------------------------------------------------------ job state

    @staticmethod
    def start_job(
        db: Session, connection: ShopifyConnection, job_type: str
    ) -> ShopifySyncJob:
        job = ShopifySyncJob(
            organization_id=connection.organization_id,
            connection_id=connection.id,
            job_type=job_type,
            status="running",
            started_at=datetime.datetime.utcnow(),
            details={},
        )
        db.add(job)
        connection.sync_status = "running"
        connection.last_sync_at = job.started_at
        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def finish_job(
        db: Session,
        job: ShopifySyncJob,
        connection: ShopifyConnection,
        status: str,
        error: Optional[str] = None,
    ) -> None:
        now = datetime.datetime.utcnow()
        job.status = status
        job.finished_at = now
        job.error_message = error[:1000] if error else None

        connection.sync_status = "success" if status == "success" else "failed"
        if status == "success":
            connection.last_successful_sync_at = now
            connection.last_error = None
        else:
            connection.last_error = error[:1000] if error else "Synchronisation failed."
        connection.updated_at = now
        db.commit()

    # ------------------------------------------------------------------- products

    @classmethod
    def upsert_products(
        cls,
        db: Session,
        connection: ShopifyConnection,
        shopify_products: List[Dict[str, Any]],
    ) -> Tuple[int, int]:
        """
        Upserts Shopify variants as EVE Products.

        Idempotency comes from ShopifyProductMapping keyed on
        (organization_id, shopify_variant_id): a re-run resolves the existing
        Product and updates it rather than inserting a second row. SKU alone is not
        used as the key because Shopify permits blank and duplicate SKUs, which
        would collapse distinct variants onto one product.

        Returns (products_seen, variants_upserted).
        """
        org_id = connection.organization_id

        existing_mappings = {
            mapping.shopify_variant_id: mapping
            for mapping in db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.organization_id == org_id)
            .all()
        }
        # Fallback index for stores connected after a CSV upload: if a SKU already
        # exists in EVE, adopt that Product instead of creating a duplicate of it.
        products_by_sku = {
            product.sku: product
            for product in db.query(Product)
            .filter(Product.organization_id == org_id)
            .all()
        }

        # Plan SKU-limit enforcement. Computed BEFORE any row is written, so a
        # batch that would cross the limit is rejected atomically rather than
        # partially applied — a webhook that adds exactly one new product must
        # not create it and then fail, leaving a half-synced catalogue.
        incoming_new_skus = set()
        for shopify_product in shopify_products:
            for mapped in ShopifyProductMapper.map_product(shopify_product):
                variant_id = mapped.get("shopify_variant_id")
                if variant_id and variant_id in existing_mappings:
                    continue
                if mapped["sku"] in products_by_sku:
                    continue
                incoming_new_skus.add(mapped["sku"])
        if incoming_new_skus:
            enforce_sku_limit(db, org_id, len(products_by_sku) + len(incoming_new_skus))

        variants_upserted = 0

        for shopify_product in shopify_products:
            mapped_variants = ShopifyProductMapper.map_product(shopify_product)
            raw_variants = {
                str(variant.get("id", "")): variant
                for variant in shopify_product.get("variants", []) or []
            }

            for mapped in mapped_variants:
                variant_id = mapped.get("shopify_variant_id")
                if not variant_id:
                    continue

                mapping = existing_mappings.get(variant_id)
                product = None

                if mapping:
                    product = (
                        db.query(Product)
                        .filter(
                            Product.id == mapping.product_id,
                            Product.organization_id == org_id,
                        )
                        .first()
                    )

                if product is None:
                    product = products_by_sku.get(mapped["sku"])

                if product is None:
                    product = Product(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        sku=mapped["sku"],
                        name=mapped["name"],
                        category=mapped["category"] or "General",
                        # Shopify does not expose COGS through the Admin API, so
                        # unit_cost stays at 0 and must come from a cost upload.
                        # Margin-based recommendations degrade rather than invent it.
                        unit_cost=0.0,
                        selling_price=mapped["selling_price"],
                    )
                    db.add(product)
                    db.flush()
                    products_by_sku[mapped["sku"]] = product
                else:
                    product.name = mapped["name"]
                    product.category = mapped["category"] or product.category
                    product.selling_price = mapped["selling_price"]
                    product.sku = mapped["sku"]

                product.parent_product_id = mapped.get("parent_product_id")
                if mapped.get("size"):
                    product.size = mapped["size"]
                if mapped.get("color"):
                    product.color = mapped["color"]

                inventory_item_id = raw_variants.get(variant_id, {}).get("inventory_item_id")

                if mapping:
                    mapping.product_id = product.id
                    mapping.shopify_product_id = mapped["shopify_product_id"]
                    mapping.sku = mapped["sku"]
                    mapping.connection_id = connection.id
                    if inventory_item_id is not None:
                        mapping.shopify_inventory_item_id = str(inventory_item_id)
                else:
                    mapping = ShopifyProductMapping(
                        organization_id=org_id,
                        connection_id=connection.id,
                        product_id=product.id,
                        shopify_product_id=mapped["shopify_product_id"],
                        shopify_variant_id=variant_id,
                        shopify_inventory_item_id=(
                            str(inventory_item_id) if inventory_item_id is not None else None
                        ),
                        sku=mapped["sku"],
                    )
                    db.add(mapping)
                    existing_mappings[variant_id] = mapping

                variants_upserted += 1

        db.commit()
        return len(shopify_products), variants_upserted

    # ------------------------------------------------------------------ inventory

    @classmethod
    def upsert_inventory_levels(
        cls,
        db: Session,
        connection: ShopifyConnection,
        levels: List[Dict[str, Any]],
    ) -> int:
        """
        Writes Shopify stock levels onto EVE InventoryItems.

        Shopify reports availability per (inventory_item, location). EVE models a
        single stock figure per product, so levels are summed across locations —
        that total is what "can I fulfil an order" depends on, and it is what the
        stockout and reorder logic already assumes.
        """
        org_id = connection.organization_id

        mappings = (
            db.query(ShopifyProductMapping)
            .filter(
                ShopifyProductMapping.organization_id == org_id,
                ShopifyProductMapping.shopify_inventory_item_id.isnot(None),
            )
            .all()
        )
        product_by_inventory_item = {
            mapping.shopify_inventory_item_id: mapping.product_id for mapping in mappings
        }

        totals: Dict[uuid.UUID, int] = defaultdict(int)
        for level in levels:
            inventory_item_id = str(level.get("inventory_item_id", ""))
            product_id = product_by_inventory_item.get(inventory_item_id)
            if not product_id:
                continue
            available = level.get("available")
            # Shopify sends null for untracked items; treat that as no signal
            # rather than as zero stock, which would raise a false stockout alarm.
            if available is None:
                continue
            totals[product_id] += max(0, int(available))

        if not totals:
            return 0

        existing_items = {
            item.product_id: item
            for item in db.query(InventoryItem)
            .filter(
                InventoryItem.organization_id == org_id,
                InventoryItem.product_id.in_(list(totals.keys())),
            )
            .all()
        }

        for product_id, stock in totals.items():
            item = existing_items.get(product_id)
            if not item:
                item = InventoryItem(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    product_id=product_id,
                    lead_time_days=14,
                )
                db.add(item)
            item.stock_on_hand = stock
            # Seed a reorder point only when one has never been set. Overwriting
            # would silently discard a value the founder or the agents computed.
            if not item.reorder_point:
                item.reorder_point = max(5, int(stock * 0.1))

        db.commit()
        return len(totals)

    # --------------------------------------------------------------------- orders

    @classmethod
    def upsert_orders(
        cls,
        db: Session,
        connection: ShopifyConnection,
        orders: List[Dict[str, Any]],
    ) -> Tuple[int, int]:
        """
        Converts Shopify order line items into EVE daily SalesRecords.

        PRECONDITION — `orders` MUST contain EVERY order for each (product, date)
        pair it touches. SalesRecord is a daily aggregate with no per-order identity,
        so this method RESTATES each pair rather than accumulating into it. Passing a
        strict subset overwrites the day with that subset: two same-day orders
        delivered separately would leave only the last one's units, silently
        understating sell-through and every forecast derived from it.
        Callers: run_sync passes a full window; the order webhook re-fetches the
        whole day first (see ShopifyWebhookService._handle_order). Do not call this
        with a single webhook payload.

        IDEMPOTENCY — see docs/sales_deduplication_decision.md. SalesRecord's own
        docstring declares it "aggregated ... for a given day and product", but no
        constraint enforces that and the CSV importers append. A sync that appended
        would inflate sell-through on every re-run, and webhooks re-run constantly.

        This writer therefore restates: it computes each (product, date) total from
        Shopify's own order data and overwrites the matching row. That is the
        last-write-wins semantics the decision document recommends (option B),
        applied to this writer only. It deliberately does NOT delete a date RANGE
        (option C, rejected there as able to destroy unrecoverable history) — only
        the exact (product, date) pairs Shopify reported are touched, so sales
        history from CSV uploads for other products or other days is untouched.

        Returns (orders_considered, sales_rows_written).
        """
        org_id = connection.organization_id

        mappings = (
            db.query(ShopifyProductMapping)
            .filter(ShopifyProductMapping.organization_id == org_id)
            .all()
        )
        # The mapper resolves line items by SKU. Blank SKUs are skipped rather than
        # guessed at — attributing a sale to the wrong product is worse than
        # omitting it, because the founder cannot see that it happened.
        sku_to_product_id = {
            mapping.sku: mapping.product_id for mapping in mappings if mapping.sku
        }
        if not sku_to_product_id:
            return len(orders), 0

        # (product_id, date) -> [units, revenue]
        aggregates: Dict[Tuple[uuid.UUID, datetime.date], List[float]] = defaultdict(
            lambda: [0.0, 0.0]
        )

        for order in orders:
            for record in ShopifyOrderMapper.map_order(order, sku_to_product_id):
                key = (record["product_id"], record["date"])
                aggregates[key][0] += float(record["quantity"])
                aggregates[key][1] += float(record["revenue"])

        if not aggregates:
            return len(orders), 0

        product_ids = {product_id for product_id, _ in aggregates}
        dates = {sale_date for _, sale_date in aggregates}

        existing_rows = (
            db.query(SalesRecord)
            .filter(
                SalesRecord.organization_id == org_id,
                SalesRecord.product_id.in_(list(product_ids)),
                SalesRecord.date.in_(list(dates)),
            )
            .all()
        )

        by_key: Dict[Tuple[uuid.UUID, datetime.date], List[SalesRecord]] = defaultdict(list)
        for row in existing_rows:
            by_key[(row.product_id, row.date)].append(row)

        written = 0
        for (product_id, sale_date), (quantity, revenue) in aggregates.items():
            units = int(round(quantity))
            if units <= 0:
                continue
            unit_price = round(revenue / units, 2) if units else 0.0

            rows = by_key.get((product_id, sale_date), [])
            if rows:
                # Collapse any pre-existing duplicates for this key onto one row,
                # which is the state the pending unique constraint will require.
                primary, *duplicates = rows
                primary.quantity = units
                primary.unit_price = unit_price
                primary.revenue = round(revenue, 2)
                for duplicate in duplicates:
                    db.delete(duplicate)
            else:
                db.add(
                    SalesRecord(
                        id=uuid.uuid4(),
                        organization_id=org_id,
                        product_id=product_id,
                        date=sale_date,
                        quantity=units,
                        unit_price=unit_price,
                        revenue=round(revenue, 2),
                    )
                )
            written += 1

        db.commit()
        return len(orders), written

    # ----------------------------------------------------------------- full syncs

    @classmethod
    async def run_sync(
        cls,
        db: Session,
        connection: ShopifyConnection,
        job_type: str = "initial",
    ) -> ShopifySyncJob:
        """
        Runs a full synchronisation: products -> inventory -> orders.

        Order matters. Inventory levels and order line items both resolve through
        the product mappings written by the first step, so running products last
        would drop every level and sale on a first sync.
        """
        job = cls.start_job(db, connection, job_type)

        try:
            client = build_client(connection)

            products = await client.get_products()
            products_seen, variants = cls.upsert_products(db, connection, products)
            job.products_synced = products_seen
            job.variants_synced = variants
            db.commit()

            inventory_item_ids = [
                mapping.shopify_inventory_item_id
                for mapping in db.query(ShopifyProductMapping)
                .filter(
                    ShopifyProductMapping.organization_id == connection.organization_id,
                    ShopifyProductMapping.shopify_inventory_item_id.isnot(None),
                )
                .all()
            ]
            if inventory_item_ids:
                levels = await client.get_inventory_levels(inventory_item_ids)
                job.inventory_synced = cls.upsert_inventory_levels(db, connection, levels)
                db.commit()

            window_start = datetime.datetime.utcnow() - datetime.timedelta(
                days=max(1, settings.SHOPIFY_ORDER_SYNC_DAYS)
            )
            orders = await client.get_orders(
                updated_at_min=window_start.replace(microsecond=0).isoformat() + "Z"
            )
            orders_seen, sales_rows = cls.upsert_orders(db, connection, orders)
            job.orders_synced = orders_seen
            job.sales_records_synced = sales_rows

            cls.finish_job(db, job, connection, "success")
            logger.info(
                "Shopify sync complete for %s: %d products, %d variants, %d stock levels, "
                "%d orders, %d sales rows.",
                connection.shop_domain,
                products_seen,
                variants,
                job.inventory_synced,
                orders_seen,
                sales_rows,
            )
            return job

        except ShopifyAuthError as exc:
            # Credentials are dead: mark the connection so the UI prompts a
            # reconnect instead of showing a sync that will never succeed.
            connection.status = "error"
            cls.finish_job(
                db,
                job,
                connection,
                "failed",
                "Shopify authorisation failed. Reconnect the store.",
            )
            logger.error("Shopify auth failure for %s: %s", connection.shop_domain, exc)
            return job

        except (ShopifyAPIError, Exception) as exc:
            db.rollback()
            cls.finish_job(db, job, connection, "failed", str(exc))
            logger.error(
                "Shopify sync failed for %s: %s", connection.shop_domain, exc, exc_info=True
            )
            return job

    @classmethod
    async def reconcile(
        cls, db: Session, connection: ShopifyConnection
    ) -> Dict[str, Any]:
        """
        Compares EVE's stored stock against Shopify's live levels without writing.

        Webhooks can be missed (delivery failures, downtime, a deploy mid-flight),
        and a silently stale stock figure produces confidently wrong reorder advice.
        This reports the drift so a sync can be triggered deliberately.
        """
        client = build_client(connection)
        org_id = connection.organization_id

        mappings = (
            db.query(ShopifyProductMapping)
            .filter(
                ShopifyProductMapping.organization_id == org_id,
                ShopifyProductMapping.shopify_inventory_item_id.isnot(None),
            )
            .all()
        )
        if not mappings:
            return {"checked": 0, "drifted": 0, "differences": []}

        product_by_inventory_item = {
            mapping.shopify_inventory_item_id: mapping for mapping in mappings
        }
        levels = await client.get_inventory_levels(list(product_by_inventory_item.keys()))

        shopify_totals: Dict[uuid.UUID, int] = defaultdict(int)
        for level in levels:
            mapping = product_by_inventory_item.get(str(level.get("inventory_item_id", "")))
            available = level.get("available")
            if not mapping or available is None:
                continue
            shopify_totals[mapping.product_id] += max(0, int(available))

        stored = {
            item.product_id: item.stock_on_hand
            for item in db.query(InventoryItem)
            .filter(
                InventoryItem.organization_id == org_id,
                InventoryItem.product_id.in_(list(shopify_totals.keys()) or [uuid.uuid4()]),
            )
            .all()
        }

        differences = []
        for product_id, shopify_stock in shopify_totals.items():
            eve_stock = stored.get(product_id, 0)
            if eve_stock != shopify_stock:
                mapping = next(
                    (m for m in mappings if m.product_id == product_id), None
                )
                differences.append(
                    {
                        "product_id": str(product_id),
                        "sku": mapping.sku if mapping else None,
                        "eve_stock": eve_stock,
                        "shopify_stock": shopify_stock,
                    }
                )

        return {
            "checked": len(shopify_totals),
            "drifted": len(differences),
            # Bounded so a badly drifted catalogue cannot return a multi-megabyte body.
            "differences": differences[:100],
        }
