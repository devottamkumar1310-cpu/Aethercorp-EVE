# ==============================================================================
# PURPOSE: Knowledge Layer - Supplier contracts facts.
# DATA FLOW: Reads Supplier tables -> returns locations, reliability ratings, and MOQs.
# EXTENSION POINTS: Add vendor compliance records or quality audit details.
# ==============================================================================

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.supplier import Supplier

logger = logging.getLogger("eve.knowledge.suppliers")


class SupplierKnowledgeRepository:
    """
    Exposes manufacturer capabilities.
    """

    @classmethod
    def get_all_suppliers(cls, db: Session, organization_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves all suppliers for an organization.
        """
        suppliers = db.query(Supplier).filter(Supplier.organization_id == organization_id).all()
        return [
            {
                "name": s.name,
                "location": s.location,
                "lead_time_days": s.lead_time_days,
                "minimum_order_qty": s.minimum_order_qty,
                "reliability_score": s.reliability_score
            }
            for s in suppliers
        ]

    @classmethod
    def get_supplier_by_name(cls, db: Session, organization_id: int, name: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a single supplier by name.
        """
        s = db.query(Supplier).filter(
            Supplier.organization_id == organization_id,
            Supplier.name == name
        ).first()
        if not s:
            return None
            
        return {
            "name": s.name,
            "location": s.location,
            "lead_time_days": s.lead_time_days,
            "minimum_order_qty": s.minimum_order_qty,
            "reliability_score": s.reliability_score
        }
