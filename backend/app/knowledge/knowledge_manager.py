# ==============================================================================
# PURPOSE: Unified Knowledge Manager.
# DATA FLOW: Routes queries to specific repository layers -> compiles facts.
# EXTENSION POINTS: Add cross-domain queries (e.g. recommend a supplier for a high-demand trend).
# ARCHITECTURAL DECISION:
# - Simplifies agent logic by providing a single lookup facade for business facts.
# ==============================================================================

import logging
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.knowledge.products import ProductKnowledgeRepository
from app.knowledge.suppliers import SupplierKnowledgeRepository
from app.knowledge.competitors import CompetitorKnowledgeRepository
from app.knowledge.trends import MarketTrendsRepository

logger = logging.getLogger("eve.knowledge.knowledge_manager")


class KnowledgeManager:
    """
    Facade coordinating catalog, vendor, and competitor benchmarks.
    """
    def __init__(self):
        self.products = ProductKnowledgeRepository
        self.suppliers = SupplierKnowledgeRepository
        self.competitors = CompetitorKnowledgeRepository
        self.trends = MarketTrendsRepository

    def query_catalog_facts(self, db: Session, organization_id: int) -> Dict[str, Any]:
        """
        Compiles a comprehensive summary of brand catalog data.
        """
        prods = self.products.get_all_products(db, organization_id)
        sups = self.suppliers.get_all_suppliers(db, organization_id)
        trends_list = self.trends.get_trending_categories()

        return {
            "products_count": len(prods),
            "suppliers_count": len(sups),
            "catalog_items": prods,
            "suppliers_list": sups,
            "market_trends": trends_list
        }


# Register KnowledgeManager inside Container
from app.core.dependency_container import container
container.register_singleton("knowledge_manager", KnowledgeManager())
