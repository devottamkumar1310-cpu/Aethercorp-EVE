# ==============================================================================
# PURPOSE: Shopify data mapping layer for EVE integration.
# DATA FLOW: Shopify API responses -> EVE Product/InventoryItem/SalesRecord models.
# EXTENSION POINTS: Add webhook payload parsing, bulk sync, delta updates.
# ==============================================================================

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

logger = logging.getLogger("eve.services.shopify_mapper")


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
                "parent_product_id": shopify_product_id,
                "category": product_type or "General",
                "size": size,
                "color": color,
                "unit_cost": 0.0,  # Shopify doesn't expose COGS — must be uploaded separately
                "selling_price": float(variant.get("price", 0.0)),
                "shopify_variant_id": str(variant.get("id", "")),
                "shopify_product_id": shopify_product_id,
            })

        return eve_products


class ShopifyInventoryMapper:
    """
    Maps Shopify inventory levels to EVE InventoryItem fields.
    """

    @classmethod
    def map_inventory_level(
        cls,
        shopify_level: Dict[str, Any],
        sku_to_product_id: Dict[str, str]
    ) -> Optional[Dict[str, Any]]:
        """
        Maps a Shopify inventory_level object to EVE InventoryItem fields.
        
        Args:
            shopify_level: Shopify inventory level API response
            sku_to_product_id: Mapping from SKU -> EVE product.id
        """
        inventory_item_id = shopify_level.get("inventory_item_id")
        available = shopify_level.get("available", 0)
        # Note: Shopify uses inventory_item_id, not SKU directly.
        # The caller must resolve the mapping.
        return {
            "stock_on_hand": max(0, available or 0),
            "shopify_inventory_item_id": str(inventory_item_id),
        }


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

            quantity = int(item.get("quantity", 0))
            unit_price = float(item.get("price", 0.0))
            # Handle partial refunds
            refund_qty = 0
            for refund in shopify_order.get("refunds", []):
                for refund_item in refund.get("refund_line_items", []):
                    if refund_item.get("line_item_id") == item.get("id"):
                        refund_qty += int(refund_item.get("quantity", 0))

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


class ShopifyConnectionConfig:
    """
    Configuration holder for a Shopify store connection.
    In production, access_token should be encrypted at rest.
    """

    def __init__(
        self,
        shop_domain: str,
        access_token: str,
        scopes: List[str] = None,
        api_version: str = "2024-07",
    ):
        self.shop_domain = shop_domain
        self.access_token = access_token
        self.scopes = scopes or [
            "read_products",
            "read_inventory",
            "read_orders",
        ]
        self.api_version = api_version

    @property
    def base_url(self) -> str:
        return f"https://{self.shop_domain}/admin/api/{self.api_version}"

    def get_headers(self) -> Dict[str, str]:
        return {
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json",
        }
