# ==============================================================================
# PURPOSE: Knowledge Layer - Product catalog facts.
# DATA FLOW: Reads Product tables -> returns structured lists of SKUs, categories, and size curves.
# EXTENSION POINTS: Add detailed fabric structures, washing care instructions, or SKU tags.
# EDUCATIONAL COMMENTS:
# - Knowledge stores static/structural organization facts (e.g. what is SKU-001's target size run?).
# - Separated from Memory (which tracks running experiences/chats).
# ==============================================================================

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.product import Product

logger = logging.getLogger("eve.knowledge.products")


class ProductKnowledgeRepository:
    """
    Exposes static product features and size curve profiles.
    """

    @classmethod
    def get_all_products(cls, db: Session, organization_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves all catalog items for an organization.
        """
        products = db.query(Product).filter(Product.organization_id == organization_id).all()
        return [
            {
                "sku": p.sku,
                "name": p.name,
                "category": p.category,
                "season": p.season,
                "size_curve": p.size_curve,
                "unit_cost": p.unit_cost,
                "supplier_name": p.supplier_name
            }
            for p in products
        ]

    @classmethod
    def get_product_by_sku(cls, db: Session, organization_id: int, sku: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a single catalog item by SKU.
        """
        p = db.query(Product).filter(
            Product.organization_id == organization_id,
            Product.sku == sku
        ).first()
        if not p:
            return None
            
        return {
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "season": p.season,
            "size_curve": p.size_curve,
            "unit_cost": p.unit_cost,
            "supplier_name": p.supplier_name
        }
