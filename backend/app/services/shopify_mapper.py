# ==============================================================================
# PURPOSE: Shopify data mapping layer for EVE integration.
# DATA FLOW: Shopify API responses -> EVE Product / SalesRecord model fields.
# EXTENSION POINTS: Add webhook payload parsing, bulk sync, delta updates.
# ARCHITECTURAL DECISION:
# - Pure field translation, no database access. The callers that persist the
#   result live in app/services/shopify/ (sync_service, webhook_service).
# - Inventory levels are NOT mapped here: EVE stores one stock figure per product
#   while Shopify reports per (inventory_item, location), so the sum has to happen
#   where the mappings are available. See ShopifySyncService.upsert_inventory_levels.
# ==============================================================================

import logging
import re
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger("eve.services.shopify_mapper")


def _safe_float(value: Any, default: float = 0.0) -> float:
    """
    Coerces a Shopify money/number field.

    Shopify sends prices as STRINGS, and sends null for variants of some product
    types (e.g. certain gift-card and service variants). A bare float() therefore
    raises on real catalogues, and because the sync maps the whole catalogue in one
    pass, a single such variant aborted the entire job — the merchant got no
    products at all rather than all-but-one.
    """
    if value is None:
        return default
    try:
        result = float(value)
    except (TypeError, ValueError):
        logger.warning("Unparseable Shopify numeric value %r; defaulting.", value)
        return default
    # inf/NaN would propagate into margin and revenue arithmetic and poison every
    # aggregate computed from it.
    if result != result or result in (float("inf"), float("-inf")):
        logger.warning("Non-finite Shopify numeric value %r; defaulting.", value)
        return default
    return result


def normalize_parent_id(parent_name: str, fallback: str) -> str:
    """
    Builds the variant-group identifier for a Shopify product.

    This MUST be human-readable. EVE's variant aggregation reports
    parent_product_id to the founder AS the SKU (analytics_service.py, variant
    aggregation), so using Shopify's numeric product id made agent answers read
    "Reorder SKU 112" — a number that appears nowhere in the merchant's Shopify
    admin and that they cannot act on.

    Mirrors app/fashion/variant_detector._normalize_parent_id so Shopify-sourced
    and CSV-sourced catalogues group and display identically.
    """
    cleaned = re.sub(r"[^a-zA-Z0-9\s\-]", "", parent_name or "")
    slug = re.sub(r"\s+", "-", cleaned.strip().upper())
    return slug or fallback


class ShopifyProductMapper:
    """
    Maps Shopify product/variant JSON to EVE Product model fields.
    Shopify products have a parent-variant structure:
    - Product: { title, product_type, variants: [...] }
    - Variant: { title, sku, option1, option2, option3, price, ... }
    """

    # Common size indicators for option detection
    SIZE_INDICATORS = {
        "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL",
        "2XL", "3XL", "4XL", "5XL",
        "00", "0", "2", "4", "6", "8", "10", "12", "14", "16",
        "24", "25", "26", "27", "28", "29", "30", "31", "32",
        "33", "34", "36", "38", "40", "42",
        "ONE SIZE", "OS", "OSFA",
    }

    @classmethod
    def classify_option(cls, option_name: str, option_value: str) -> str:
        """
        Classifies a Shopify option as 'size', 'color', or 'other'.
        Shopify uses option1/option2/option3 with corresponding option names.
        """
        name_lower = option_name.lower().strip()
        value_upper = option_value.upper().strip()

        if name_lower in ["size", "sizes", "talla"]:
            return "size"
        if name_lower in ["color", "colour", "colors", "colours"]:
            return "color"
        # Heuristic: if the value looks like a size
        if value_upper in cls.SIZE_INDICATORS:
            return "size"
        # Default: treat as color if it's the first unclassified option
        return "other"

    @classmethod
    def map_product(cls, shopify_product: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Maps a single Shopify product (with variants) to a list of EVE Product dicts.
        Each Shopify variant becomes one EVE Product row with parent_product_id linking them.
        
        Returns list of dicts ready for EVE Product model creation.
        """
        parent_title = shopify_product.get("title", "Unknown Product")
        product_type = shopify_product.get("product_type", "General")
        shopify_product_id = str(shopify_product.get("id", ""))
        
        # Determine option names (e.g., ["Size", "Color"])
        options = shopify_product.get("options", [])
        option_names = {}
        for opt in options:
            pos = opt.get("position", 1)
            option_names[pos] = opt.get("name", f"Option{pos}")

        variants = shopify_product.get("variants", [])
        eve_products = []

        for variant in variants:
            sku = variant.get("sku", "").strip()
            if not sku:
                sku = f"{shopify_product_id}-{variant.get('id', '')}"

            # Extract size and color from options
            size = None
            color = None
            for pos in [1, 2, 3]:
                opt_value = variant.get(f"option{pos}")
                if not opt_value:
                    continue
                opt_name = option_names.get(pos, f"Option{pos}")
                classification = cls.classify_option(opt_name, opt_value)
                if classification == "size" and size is None:
                    size = opt_value.strip()
                elif classification == "color" and color is None:
                    color = opt_value.strip()

            # Build variant display name
            variant_parts = []
            if color:
                variant_parts.append(color)
            if size:
                variant_parts.append(size)
            variant_suffix = " / ".join(variant_parts) if variant_parts else variant.get("title", "")
            display_name = f"{parent_title} - {variant_suffix}" if variant_suffix else parent_title

            eve_products.append({
                "sku": sku,
                "name": display_name,
                # Human-readable group id, NOT the Shopify product id — see
                # normalize_parent_id. The numeric id is preserved separately in
                # shopify_product_id for sync identity.
                "parent_product_id": normalize_parent_id(parent_title, shopify_product_id),
                "category": product_type or "General",
                "size": size,
                "color": color,
                "unit_cost": 0.0,  # Shopify doesn't expose COGS — must be uploaded separately
                "selling_price": _safe_float(variant.get("price"), 0.0),
                "shopify_variant_id": str(variant.get("id", "")),
                "shopify_product_id": shopify_product_id,
            })

        return eve_products


class ShopifyOrderMapper:
    """
    Maps Shopify order line items to EVE SalesRecord entries.
    """

    @classmethod
    def map_order(
        cls,
        shopify_order: Dict[str, Any],
        sku_to_product_id: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """
        Maps a Shopify order to a list of EVE SalesRecord dicts.
        
        Args:
            shopify_order: Shopify order API response
            sku_to_product_id: Mapping from SKU -> EVE product.id
        """
        records = []
        order_date = shopify_order.get("created_at", "")
        if order_date:
            try:
                order_date = datetime.fromisoformat(order_date.replace("Z", "+00:00")).date()
            except (ValueError, AttributeError):
                order_date = datetime.utcnow().date()
        else:
            order_date = datetime.utcnow().date()

        financial_status = shopify_order.get("financial_status", "paid")
        if financial_status in ["refunded", "voided"]:
            return []  # Skip fully refunded/voided orders

        for item in shopify_order.get("line_items", []):
            sku = item.get("sku", "").strip()
            if not sku or sku not in sku_to_product_id:
                continue

            quantity = int(_safe_float(item.get("quantity"), 0.0))
            unit_price = _safe_float(item.get("price"), 0.0)
            # A negative line quantity would subtract from the day's units and
            # understate sell-through, so it is discarded rather than trusted.
            if quantity <= 0:
                continue
            # Handle partial refunds
            refund_qty = 0
            for refund in shopify_order.get("refunds", []):
                for refund_item in refund.get("refund_line_items", []):
                    if refund_item.get("line_item_id") == item.get("id"):
                        refund_qty += int(_safe_float(refund_item.get("quantity"), 0.0))

            net_quantity = max(0, quantity - refund_qty)
            if net_quantity <= 0:
                continue

            records.append({
                "product_id": sku_to_product_id[sku],
                "date": order_date,
                "quantity": net_quantity,
                "unit_price": unit_price,
                "revenue": round(net_quantity * unit_price, 2),
            })

        return records
