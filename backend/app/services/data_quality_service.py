import logging
import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord

logger = logging.getLogger("eve.services.data_quality_service")

class DataQualityError(Exception):
    """Exception raised when a critical data quality failure is detected."""
    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.errors = errors

class DataQualityService:
    @staticmethod
    def validate_dataset(db: Session, organization_id: uuid.UUID) -> Dict[str, Any]:
        """
        Runs comprehensive data quality validation checks across the organization's business metrics.
        Returns:
            {
                "is_corrupted": bool,
                "critical_errors": List[str],
                "warnings": List[str]
            }
        """
        critical_errors = []
        warnings = []

        # 1. Validate Products & Margins
        products = db.query(Product).filter(Product.organization_id == organization_id).all()
        sku_seen = set()
        for p in products:
            # Check duplicate SKU in DB
            if p.sku in sku_seen:
                critical_errors.append(f"Duplicate product record detected for SKU: '{p.sku}'.")
            sku_seen.add(p.sku)

            # Check missing critical values
            if not p.name or p.name.strip() == "":
                critical_errors.append(f"Product with ID {p.id} has a missing or empty name.")
            if not p.sku or p.sku.strip() == "":
                critical_errors.append(f"Product with ID {p.id} has a missing or empty SKU.")

            # Check warnings: missing category or season
            if not p.category or p.category.strip() == "General":
                warnings.append(f"Product '{p.sku}' has general/uncategorized classification.")

            # Check margins
            cost = p.unit_cost or 0.0
            price = p.selling_price or 0.0
            if cost < 0:
                critical_errors.append(f"Product '{p.sku}' has negative unit cost: ${cost}.")
            if price < 0:
                critical_errors.append(f"Product '{p.sku}' has negative selling price: ${price}.")
            
            # Impossible margins: Selling price < cost
            if price > 0 and price < cost:
                critical_errors.append(
                    f"Impossible margin for product '{p.sku}': Selling price (${price}) is less than unit cost (${cost})."
                )
            elif price == 0 and cost > 0:
                warnings.append(f"Product '{p.sku}' has cost ${cost} but price is $0 (unsellable).")

        # 2. Validate Inventory Items
        inventory = db.query(InventoryItem).filter(InventoryItem.organization_id == organization_id).all()
        for item in inventory:
            if item.stock_on_hand is None:
                critical_errors.append(f"Inventory item for Product ID {item.product_id} has null stock_on_hand.")
            elif item.stock_on_hand < 0:
                critical_errors.append(f"Negative inventory level detected for SKU '{item.product.sku if item.product else item.product_id}': {item.stock_on_hand} units.")

            if item.lead_time_days is not None and item.lead_time_days < 0:
                warnings.append(f"Inventory SKU '{item.product.sku if item.product else item.product_id}' has negative lead time: {item.lead_time_days} days.")

        # 3. Validate Sales Records
        sales = db.query(SalesRecord).filter(SalesRecord.organization_id == organization_id).all()
        for record in sales:
            if record.quantity is None or record.quantity < 0:
                critical_errors.append(f"Invalid sales log (ID: {record.id}): Quantity cannot be negative or null (got: {record.quantity}).")
            if record.unit_price is not None and record.unit_price < 0:
                critical_errors.append(f"Invalid sales log (ID: {record.id}): Unit price cannot be negative (got: {record.unit_price}).")
            if record.revenue is not None and record.revenue < 0:
                critical_errors.append(f"Invalid sales log (ID: {record.id}): Revenue cannot be negative (got: {record.revenue}).")
            
            # Math mismatch warning
            if record.quantity and record.unit_price and record.revenue:
                expected_rev = record.quantity * record.unit_price
                if abs(expected_rev - record.revenue) > 0.05:
                    warnings.append(f"Sales record ID {record.id} revenue mismatch: quantity={record.quantity} * price={record.unit_price} is expected to be ${expected_rev:.2f}, but database holds ${record.revenue:.2f}.")

        is_corrupted = len(critical_errors) > 0
        return {
            "is_corrupted": is_corrupted,
            "critical_errors": critical_errors,
            "warnings": warnings
        }

    @classmethod
    def check_and_block_if_corrupted(cls, db: Session, organization_id: uuid.UUID):
        """
        Inspects the organization's database. Raises DataQualityError if critical corruption is found.
        """
        report = cls.validate_dataset(db, organization_id)
        if report["is_corrupted"]:
            msg = "Analytics engine execution blocked due to database corruption."
            logger.error(f"[DATA QUALITY BLOCK] Org: {organization_id} | {msg} | Errors: {report['critical_errors']}")
            raise DataQualityError(message=msg, errors=report["critical_errors"])
