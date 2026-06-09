# ==============================================================================
# PURPOSE: Mock Shopify store connector service.
# DATA FLOW: Synchronizes catalog schemas and updates remote prices.
# EXTENSION POINTS: Replace mocks with direct requests to the Shopify REST/GraphQL Admin APIs.
# ARCHITECTURAL DECISION:
# - Encapsulates external E-Commerce synchronizations into a standalone service.
# ==============================================================================

import logging
from typing import List, Dict, Any

logger = logging.getLogger("eve.services.shopify_service")


class ShopifyService:
    """
    Mock service handling Shopify storefront connections.
    """
    def __init__(self):
        logger.info("Shopify Mock Service connector active.")

    def fetch_shopify_catalog(self, organization_id: int) -> List[Dict[str, Any]]:
        """
        Simulates retrieving active catalog listings.
        """
        logger.info(f"Shopify: Fetching remote catalog for Org: {organization_id}")
        return [
            {"sku": "SKU-001", "price": 45.0, "title": "Silk Summer Dress"},
            {"sku": "SKU-002", "price": 89.0, "title": "Denim Jacket"},
        ]

    def sync_recommended_price(self, organization_id: int, sku: str, new_price: float) -> bool:
        """
        Simulates pushing updated retail pricing back to Shopify.
        """
        logger.info(f"Shopify: Syncing price adjustment for SKU '{sku}' -> ${new_price:.2f} (Org: {organization_id})")
        return True


# Register ShopifyService inside Container
from app.core.dependency_container import container
container.register_singleton("shopify_service", ShopifyService())
