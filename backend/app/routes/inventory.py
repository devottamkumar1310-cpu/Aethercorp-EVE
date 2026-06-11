# ==============================================================================
# PURPOSE: Inventory and CSV Data Upload API Routes.
# DATA FLOW: Takes CSV files -> parses using Pandas with flexible column mapping ->
#            upserts into Product, InventoryItem, and SalesRecord database tables.
# EXTENSION POINTS: Add CSV schema schema validation, support asynchronous queues.
# ARCHITECTURAL DECISION:
# - Relaxed column validations allow various spreadsheet templates to load seamlessly.
# - Leverages database fallback queries to resolve missing metrics (e.g. using
#   product selling_price to calculate sales revenue if missing in the CSV).
# ==============================================================================

import io
import datetime
import logging
import pandas as pd
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.core.security import get_current_user_and_tenant
from app.services.importer_service import ImporterService

logger = logging.getLogger("eve.routes.inventory")
router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.post("/upload/inventory", status_code=status.HTTP_201_CREATED)
def upload_inventory_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant)
):
    """
    Uploads and parses inventory.csv.
    """
    org_id = token_context["organization_id"]
    logger.info(f"Inventory Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        df = pd.read_csv(io.BytesIO(contents))
        report = ImporterService.import_inventory(db, org_id, df)
        if report["status"] == "error":
            raise HTTPException(status_code=400, detail=f"Import failed: {report['errors']}")
        return {"status": "success", "message": f"Processed {report['processed_count']} inventory records."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Inventory Upload Error: {e}", exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process inventory CSV: {str(e)}"
        )


@router.post("/upload/sales", status_code=status.HTTP_201_CREATED)
def upload_sales_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant)
):
    """
    Uploads and parses sales.csv.
    """
    org_id = token_context["organization_id"]
    logger.info(f"Sales Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        df = pd.read_csv(io.BytesIO(contents))
        report = ImporterService.import_sales(db, org_id, df)
        if report["status"] == "error":
            raise HTTPException(status_code=400, detail=f"Import failed: {report['errors']}")
        return {"status": "success", "message": f"Recorded {report['processed_count']} sales transactions."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Sales Upload Error: {e}", exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process sales CSV: {str(e)}"
        )


@router.post("/upload/costs", status_code=status.HTTP_201_CREATED)
def upload_product_costs_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant)
):
    """
    Uploads and parses product_cost.csv / costs.csv.
    """
    org_id = token_context["organization_id"]
    logger.info(f"Costs Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        df = pd.read_csv(io.BytesIO(contents))
        report = ImporterService.import_costs(db, org_id, df)
        if report["status"] == "error":
            raise HTTPException(status_code=400, detail=f"Import failed: {report['errors']}")
        return {"status": "success", "message": f"Updated costs for {report['processed_count']} products."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Costs Upload Error: {e}", exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process product cost CSV: {str(e)}"
        )


@router.get("/dashboard")
def get_inventory_dashboard(
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant)
):
    """
    Returns aggregated metrics and product performance for the inventory dashboard.
    """
    from sqlalchemy import func
    org_id = token_context["organization_id"]
    
    try:
        # Fetch inventory items and products
        items = db.query(InventoryItem).options(joinedload(InventoryItem.product)).filter(InventoryItem.organization_id == org_id).all()
        
        # Calculate total value and stock counts
        total_value = sum(item.stock_on_hand * (item.product.unit_cost or 0.0) for item in items)
        total_items_count = sum(item.stock_on_hand for item in items)
        low_stock_count = sum(1 for item in items if item.stock_on_hand <= item.reorder_point)
        
        # Fetch sales aggregated by product
        sales_data = db.query(
            SalesRecord.product_id,
            func.sum(SalesRecord.quantity).label("total_qty"),
            func.sum(SalesRecord.revenue).label("total_rev")
        ).filter(SalesRecord.organization_id == org_id)\
         .group_by(SalesRecord.product_id).all()
         
        sales_map = {row[0]: {"qty": int(row[1]), "rev": float(row[2])} for row in sales_data}
        
        product_metrics = []
        for item in items:
            prod = item.product
            sales = sales_map.get(prod.id, {"qty": 0, "rev": 0.0})
            qty_sold = sales["qty"]
            revenue = sales["rev"]
            cogs = qty_sold * (prod.unit_cost or 0.0)
            profit = revenue - cogs
            margin = (profit / revenue * 100.0) if revenue > 0 else 0.0
            
            product_metrics.append({
                "sku": prod.sku,
                "name": prod.name,
                "category": prod.category,
                "stock_on_hand": item.stock_on_hand,
                "unit_cost": prod.unit_cost or 0.0,
                "qty_sold": qty_sold,
                "revenue": round(revenue, 2),
                "profit": round(profit, 2),
                "margin_percent": round(margin, 2)
            })
            
        # Extract best and worst sellers
        best_sellers = sorted(product_metrics, key=lambda x: x["qty_sold"], reverse=True)[:5]
        worst_sellers = sorted(product_metrics, key=lambda x: x["qty_sold"])[:5]
        
        return {
            "total_inventory_value": round(total_value, 2),
            "total_items_count": total_items_count,
            "low_stock_count": low_stock_count,
            "best_sellers": best_sellers,
            "worst_sellers": worst_sellers,
            "product_metrics": product_metrics
        }
    except Exception as e:
        logger.error(f"Inventory Dashboard Error: {e}", exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load inventory dashboard data: {str(e)}"
        )
