# ==============================================================================
# PURPOSE: Supplier and Manufacturer Catalog Mock Service.
# DATA FLOW: Takes supplier IDs/Names -> retrieves production rates, MOQ, and locations.
# EXTENSION POINTS: Connect to supplier ERP gateways or RFQ portal databases.
# ==============================================================================

import logging
from typing import List, Dict, Any

logger = logging.getLogger("eve.services.supplier_service")


class SupplierService:
    """
    Mock service providing supplier quotes and reliability scores.
    """
    def __init__(self):
        logger.info("Supplier Service manager online.")

    def search_suppliers(self, category: str) -> List[Dict[str, Any]]:
        """
        Simulates searching suppliers by production category.
        """
        logger.info(f"SupplierService: Searching active vendors for category: '{category}'")
        return [
            {
                "supplier_name": "Apex Garments",
                "location": "Vietnam",
                "lead_time_days": 25,
                "minimum_order_qty": 200,
                "quality_grade": "A",
                "reliability_rating": 0.94
            },
            {
                "supplier_name": "TexCorp Turkey",
                "location": "Turkey",
                "lead_time_days": 18,
                "minimum_order_qty": 100,
                "quality_grade": "B+",
                "reliability_rating": 0.91
            }
        ]


# Register SupplierService inside Container
from app.core.dependency_container import container
container.register_singleton("supplier_service", SupplierService())
