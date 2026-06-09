# ==============================================================================
# PURPOSE: Knowledge Layer - Competitor pricing facts.
# DATA FLOW: Queries competitor indices -> returns benchmark structures.
# EXTENSION POINTS: Add historic competitor markdown schedule logs.
# ==============================================================================

import logging
from typing import Dict, Any
from app.core.dependency_container import container

logger = logging.getLogger("eve.knowledge.competitors")


class CompetitorKnowledgeRepository:
    """
    Exposes external competitor price benchmarks.
    """

    @classmethod
    def get_competitor_profile(cls, sku: str) -> Dict[str, Any]:
        """
        Retrieves competitor price indexes for benchmarking.
        """
        comp_service = container.get("competitor_service")
        return comp_service.get_competitor_price(sku)
