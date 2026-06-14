import logging
import uuid
import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.models.finance import Revenue, Expense
from app.models.audit_log import AuditLog
from app.services.document_intelligence.extraction_engine import (
    InvoiceExtractionResult,
    PurchaseOrderExtractionResult,
    ExpenseExtractionResult,
    SalesReportExtractionResult,
    InventoryReportExtractionResult
)

logger = logging.getLogger("eve.services.validation_engine")

class DataQualityAssessment(BaseModel):
    quality_score: float = Field(..., description="Overall data quality score from 0.0 to 100.0")
    detected_issues: List[str] = Field(..., description="List of issues detected during validation")
    recommended_actions: List[str] = Field(..., description="List of recommended actions to resolve detected issues")

class ValidationEngine:
    @staticmethod
    def validate_extraction(
        db: Session,
        org_id: uuid.UUID,
        extraction_result: BaseModel
    ) -> DataQualityAssessment:
        """
        Runs logic constraints and data quality assertions on the extracted document details.
        """
        quality_score = 100.0
        detected_issues = []
        recommended_actions = []
        
        # 1. Invoice Extraction Validation
        if isinstance(extraction_result, InvoiceExtractionResult):
            # Check empty invoice number
            if not extraction_result.invoice_number or extraction_result.invoice_number.strip() == "":
                quality_score -= 30.0
                detected_issues.append("Invoice number is missing or empty.")
                recommended_actions.append("Manually input the invoice identifier.")
            else:
                # Check duplicate invoice in database
                inv_num = extraction_result.invoice_number.strip()
                dup_rev = db.query(Revenue).filter(
                    Revenue.organization_id == org_id,
                    Revenue.description.like(f"%{inv_num}%")
                ).first()
                dup_exp = db.query(Expense).filter(
                    Expense.organization_id == org_id,
                    Expense.description.like(f"%{inv_num}%")
                ).first()
                if dup_rev or dup_exp:
                    quality_score -= 55.0
                    detected_issues.append(f"Duplicate invoice detected (Invoice Number: '{inv_num}').")
                    recommended_actions.append("Verify if this invoice has already been paid or ingested.")

            # Check empty invoice date
            if not extraction_result.invoice_date or extraction_result.invoice_date.strip() == "":
                quality_score -= 20.0
                detected_issues.append("Invoice date is missing or empty.")
                recommended_actions.append("Provide a valid date for transaction tracking.")
            else:
                # Validate date format YYYY-MM-DD
                try:
                    datetime.datetime.strptime(extraction_result.invoice_date.strip(), "%Y-%m-%d")
                except ValueError:
                    quality_score -= 15.0
                    detected_issues.append(f"Inconsistent invoice date format: '{extraction_result.invoice_date}'.")
                    recommended_actions.append("Standardize date format to YYYY-MM-DD.")

            # Validate items math and values
            has_negative = False
            items_total = 0.0
            for item in extraction_result.items:
                if item.quantity < 0 or item.unit_price < 0:
                    has_negative = True
                items_total += item.quantity * item.unit_price
                
            if has_negative:
                quality_score -= 40.0
                detected_issues.append("Negative quantity or price detected in invoice line items.")
                recommended_actions.append("Confirm line item values do not represent returns or credit notes.")

            expected_total = items_total + getattr(extraction_result, "tax", 0.0)
            if abs(expected_total - extraction_result.total_amount) > 0.05:
                quality_score -= 20.0
                detected_issues.append(
                    f"Invoice total amount mismatch: items sum to ${expected_total:.2f} but total specifies ${extraction_result.total_amount:.2f}."
                )
                recommended_actions.append("Recalculate invoice totals including taxes/discounts.")

        # 2. Purchase Order Extraction Validation
        elif isinstance(extraction_result, PurchaseOrderExtractionResult):
            if not extraction_result.po_number or extraction_result.po_number.strip() == "":
                quality_score -= 30.0
                detected_issues.append("Purchase Order number is missing or empty.")
                recommended_actions.append("Manually input the PO number.")
            else:
                # Check duplicate PO from audit logs
                po_num = extraction_result.po_number.strip()
                dup_po = db.query(AuditLog).filter(
                    AuditLog.organization_id == org_id,
                    AuditLog.message.like(f"%{po_num}%")
                ).first()
                if dup_po:
                    quality_score -= 55.0
                    detected_issues.append(f"Duplicate Purchase Order detected (PO Number: '{po_num}').")
                    recommended_actions.append("Verify if this purchase order was already processed.")

            if extraction_result.quantity < 0 or extraction_result.unit_cost < 0:
                quality_score -= 40.0
                detected_issues.append("Negative quantity or unit cost detected in purchase order.")
                recommended_actions.append("Verify ordered count and costs.")

            expected_total = extraction_result.quantity * extraction_result.unit_cost
            if abs(expected_total - extraction_result.total_cost) > 0.05:
                quality_score -= 15.0
                detected_issues.append(
                    f"PO total cost mismatch: expected ${expected_total:.2f} but PO specifies ${extraction_result.total_cost:.2f}."
                )
                recommended_actions.append("Verify total cost math.")

        # 3. Expense Extraction Validation
        elif isinstance(extraction_result, ExpenseExtractionResult):
            if extraction_result.amount < 0:
                quality_score -= 40.0
                detected_issues.append("Negative expense amount detected.")
                recommended_actions.append("Ensure expense does not represent a refund.")

            if not extraction_result.date or extraction_result.date.strip() == "":
                quality_score -= 20.0
                detected_issues.append("Expense date is missing.")
                recommended_actions.append("Specify transaction date.")

        # 4. Sales Report Extraction Validation
        elif isinstance(extraction_result, SalesReportExtractionResult):
            for record in extraction_result.sales_records:
                if record.quantity < 0 or record.unit_price < 0 or record.revenue < 0:
                    quality_score -= 30.0
                    detected_issues.append(f"Negative sales metric found for SKU '{record.sku}'.")
                    recommended_actions.append("Review sales report columns and clean negative rows.")
                    break

        # 5. Inventory Report Extraction Validation
        elif isinstance(extraction_result, InventoryReportExtractionResult):
            for item in extraction_result.inventory_items:
                if item.stock_on_hand < 0 or item.lead_time_days < 0:
                    quality_score = max(0.0, quality_score - 25.0)
                    detected_issues.append(f"Negative inventory or lead time found for SKU '{item.sku}'.")
                    recommended_actions.append("Check stock count logs for discrepancies.")
                    break

        # Bounds safety clamping
        quality_score = max(0.0, min(100.0, quality_score))
        return DataQualityAssessment(
            quality_score=quality_score,
            detected_issues=detected_issues,
            recommended_actions=recommended_actions
        )
