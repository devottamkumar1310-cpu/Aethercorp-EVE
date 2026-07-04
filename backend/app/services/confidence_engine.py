import uuid
from sqlalchemy.orm import Session

class ConfidenceEngine:
    @staticmethod
    def calculate_confidence(scenario_type: str, data_points: int = 100) -> int:
        """
        Legacy mock confidence mapping.
        """
        base_confidence = 85
        if scenario_type == "price_change":
            base_confidence -= 10
        elif scenario_type == "demand_growth":
            base_confidence -= 5
        elif scenario_type == "demand_decline":
            base_confidence -= 8
        elif scenario_type == "inventory_expansion":
            base_confidence += 5
        elif scenario_type == "cash_flow_forecast":
            base_confidence -= 2
        variance = (data_points % 5) - 2
        return max(0, min(100, base_confidence + variance))

    @staticmethod
    def calculate_deterministic_confidence(scenario_type: str, db: Session, org_id: uuid.UUID) -> float:
        """
        Calculates a deterministic confidence score (0.0 to 1.0) based on:
        - Data Quality (number of records available)
        - Forecast Reliability (sales volume variance)
        """
        from app.models.inventory import SalesRecord, InventoryItem
        from app.models.product import Product

        # 1. Evaluate Data Quality
        try:
            sales_count = db.query(SalesRecord).filter(SalesRecord.organization_id == org_id).count()
            product_count = db.query(Product).filter(Product.organization_id == org_id).count()
            inventory_count = db.query(InventoryItem).filter(InventoryItem.organization_id == org_id).count()
        except Exception:
            return 0.50

        # Base confidence starts at 0.5
        score = 0.50

        # Quality booster based on record counts
        if sales_count > 500:
            score += 0.20
        elif sales_count > 100:
            score += 0.10

        if product_count > 5:
            score += 0.10
        if inventory_count > 5:
            score += 0.10

        # 2. Forecast Reliability (CV of sales quantities)
        try:
            sales_records = db.query(SalesRecord.quantity).filter(SalesRecord.organization_id == org_id).limit(100).all()
            quantities = [r[0] for r in sales_records if r[0] is not None]
            if len(quantities) > 1:
                mean = sum(quantities) / len(quantities)
                if mean > 0:
                    variance = sum((x - mean) ** 2 for x in quantities) / len(quantities)
                    std_dev = variance ** 0.5
                    cv = std_dev / mean
                    if cv < 0.2:
                        score += 0.10  # Low volatility = higher reliability
                    elif cv > 0.8:
                        score -= 0.10  # High volatility = lower reliability
        except Exception:
            pass

        # Adjust for scenario risk
        if scenario_type == "price_change":
            score -= 0.05
        elif scenario_type == "cash_flow_forecast":
            score -= 0.02

        # Check if cash availability is unknown (no configurable cash and no financial records uploaded)
        try:
            from app.models.memory import MemoryEntry
            from app.models.finance import Revenue, Expense
            has_configurable_cash = db.query(MemoryEntry).filter(
                MemoryEntry.organization_id == org_id,
                MemoryEntry.content.like("cash_balance:%")
            ).count() > 0
            has_financial_data = (
                db.query(Revenue).filter(Revenue.organization_id == org_id).count() > 0 or
                db.query(Expense).filter(Expense.organization_id == org_id).count() > 0
            )
            if not has_configurable_cash and not has_financial_data:
                score -= 0.15
        except Exception:
            pass

        return round(max(0.10, min(1.00, score)), 2)
