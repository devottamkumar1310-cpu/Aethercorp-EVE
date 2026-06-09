# ==============================================================================
# PURPOSE: Competitor Price Scraper Mock Service.
# DATA FLOW: Takes SKUs -> simulates scraping competitor pricing -> returns price benchmarks.
# EXTENSION POINTS: Replace mocks with search feeds, BrightData scrapers, or Google Shopping API.
# ARCHITECTURAL DECISION:
# - Encapsulates external scraping dependencies to protect business calculations.
# ==============================================================================

import logging
from typing import Dict, Any

logger = logging.getLogger("eve.services.competitor_service")


class CompetitorService:
    """
    Mock service providing market indexing competitor price data.
    """
    def __init__(self):
        logger.info("Competitor Mock Price Scraper online.")

    def get_competitor_price(self, sku: str) -> Dict[str, Any]:
        """
        Simulates retrieving current competitor listings for comparison.
        """
        # Return mock competitor prices relative to SKU
        competitor_msrp = 55.0
        if "SKU-001" in sku:
            competitor_msrp = 48.0
        elif "SKU-002" in sku:
            competitor_msrp = 95.0

        return {
            "sku": sku,
            "competitor_name": "TrendStyle Co",
            "competitor_price": competitor_msrp,
            "scraping_timestamp": "2026-06-07T12:00:00Z"
        }


# Register CompetitorService inside Container
from app.core.dependency_container import container
container.register_singleton("competitor_service", CompetitorService())
