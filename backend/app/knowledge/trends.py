# ==============================================================================
# PURPOSE: Knowledge Layer - Market trends facts.
# DATA FLOW: Simulates market sentiment signals -> returns active fashion search indexes.
# EXTENSION POINTS: Connect to Google Trends APIs or social media crawlers.
# ==============================================================================

import logging
from typing import Dict, Any, List

logger = logging.getLogger("eve.knowledge.trends")


class MarketTrendsRepository:
    """
    Exposes fashion category demand signals.
    """

    @classmethod
    def get_trending_categories(cls) -> List[Dict[str, Any]]:
        """
        Mock lookup for currently trending D2C search categories.
        """
        return [
            {"category": "Dresses", "search_volume_growth_pct": 18.5, "sentiment": "positive"},
            {"category": "Outerwear", "search_volume_growth_pct": -4.2, "sentiment": "neutral"},
            {"category": "Tops", "search_volume_growth_pct": 12.0, "sentiment": "positive"}
        ]
