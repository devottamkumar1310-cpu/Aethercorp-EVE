# ==============================================================================
# PURPOSE: Shopify store integration service.
# DATA FLOW: Shopify REST/GraphQL Admin API <-> ShopifyMapper <-> EVE models.
# EXTENSION POINTS: Replace mock methods with live API calls after OAuth implementation.
# ARCHITECTURAL DECISION:
# - Separated mapping logic (shopify_mapper.py) from API interaction (this file).
# - Currently operates in mock/dry-run mode. OAuth flow is documented but not implemented.
# ==============================================================================

import logging
from typing import List, Dict, Any, Optional
from app.core.dependency_container import container
from app.services.shopify_mapper import (
    ShopifyProductMapper,
    ShopifyInventoryMapper,
    ShopifyOrderMapper,
    ShopifyConnectionConfig,
)

logger = logging.getLogger("eve.services.shopify_service")


class ShopifyService:
    """
    Integration service for syncing Shopify store data with EVE.
    Currently in mock mode — real API calls require OAuth implementation.
    """

    def __init__(self):
        logger.info("Shopify Integration Service initialized (mock mode).")
        self._connection: Optional[ShopifyConnectionConfig] = None

    def configure(self, shop_domain: str, access_token: str, api_version: str = "2024-07"):
        """Configure the Shopify connection (post-OAuth)."""
        self._connection = ShopifyConnectionConfig(
            shop_domain=shop_domain,
            access_token=access_token,
            api_version=api_version,
        )
        logger.info(f"Shopify connection configured for {shop_domain}")

    @property
    def is_connected(self) -> bool:
        return self._connection is not None

    def fetch_and_map_products(self, organization_id: Any) -> List[Dict[str, Any]]:
        """
        Fetches products from Shopify and maps them to EVE Product format.
        Returns a list of dicts ready for Product model creation.
        
        Currently returns mock data. Replace with real API call post-OAuth.
        """
        logger.info(f"Shopify: Fetching and mapping products for Org: {organization_id}")

        if not self.is_connected:
            logger.warning("Shopify not connected. Returning mock catalog.")
            # Return mock data that demonstrates the mapping format
            mock_shopify_product = {
                "id": 1234567890,
                "title": "Classic Cotton Tee",
                "product_type": "Tops",
                "options": [
                    {"position": 1, "name": "Color"},
                    {"position": 2, "name": "Size"},
                ],
                "variants": [
                    {"id": 1, "sku": "CCT-WHT-S", "option1": "White", "option2": "S", "price": "29.99"},
                    {"id": 2, "sku": "CCT-WHT-M", "option1": "White", "option2": "M", "price": "29.99"},
                    {"id": 3, "sku": "CCT-WHT-L", "option1": "White", "option2": "L", "price": "29.99"},
                    {"id": 4, "sku": "CCT-BLK-S", "option1": "Black", "option2": "S", "price": "29.99"},
                    {"id": 5, "sku": "CCT-BLK-M", "option1": "Black", "option2": "M", "price": "29.99"},
                ]
            }
            return ShopifyProductMapper.map_product(mock_shopify_product)

        # TODO: Real implementation after OAuth
        # products = self._api_get("/products.json")["products"]
        # return [mapped for p in products for mapped in ShopifyProductMapper.map_product(p)]
        return []

    def sync_price_adjustment(self, organization_id: Any, sku: str, new_price: float) -> bool:
        """
        Pushes a price update back to Shopify.
        Currently a mock. Replace with real API call post-OAuth.
        """
        logger.info(f"Shopify: Price sync for SKU '{sku}' -> ${new_price:.2f} (Org: {organization_id})")
        if not self.is_connected:
            logger.warning("Shopify not connected. Price sync skipped.")
            return False
        # TODO: PUT /admin/api/{version}/variants/{variant_id}.json
        return True


# Register ShopifyService inside Container
container.register_singleton("shopify_service", ShopifyService())
