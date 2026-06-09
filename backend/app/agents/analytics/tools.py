# ==============================================================================
# PURPOSE: Analytics Agent Tools.
# DATA FLOW: Takes tenant ID -> queries DB for sales volume and revenue totals -> returns math summary.
# EXTENSION POINTS: Add size curve distributions and seasonality indexing metrics.
# ==============================================================================

import logging
from typing import Dict, Any
from sqlalchemy import func
from app.core.tool_registry import register_tool
from app.database import SessionLocal
from app.models.inventory import SalesRecord

logger = logging.getLogger("eve.agents.analytics.tools")


@register_tool(name="run_financial_summary")
def run_financial_summary(organization_id: int) -> Dict[str, Any]:
    """
    Retrieves gross sales, orders count, and net revenue aggregates for the organization.
    """
    logger.info(f"Analytics Tool: Summarizing financials for Org: {organization_id}")
    db = SessionLocal()
    try:
        # Sum sales quantities and revenues
        totals = db.query(
            func.sum(SalesRecord.quantity).label("total_qty"),
            func.sum(SalesRecord.revenue).label("total_revenue"),
            func.count(SalesRecord.id).label("sales_records_count")
        ).filter(SalesRecord.organization_id == organization_id).first()

        qty = int(totals[0]) if totals and totals[0] else 0
        rev = float(totals[1]) if totals and totals[1] else 0.0
        cnt = int(totals[2]) if totals and totals[2] else 0

        return {
            "total_units_sold": qty,
            "total_sales_revenue": round(rev, 2),
            "total_orders_logged": cnt,
            "calculation_timestamp": "2026-06-07T12:00:00Z"
        }
    finally:
        db.close()
