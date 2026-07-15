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
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.core.security import get_current_user_and_tenant, require_workspace_role
from app.services.importer_service import ImporterService
from app.core.rate_limiter import rate_limit
from app.fashion.gmroi import calculate_gmroi
from app.fashion.sell_through import calculate_sell_through_rate
from app.fashion.inventory_turnover import calculate_inventory_turnover

logger = logging.getLogger("eve.routes.inventory")
router = APIRouter(prefix="/api/inventory", tags=["inventory"])

MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB hard limit for uploaded CSV files



@router.post("/upload/inventory", status_code=status.HTTP_201_CREATED)
def upload_inventory_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant),
    _: None = Depends(rate_limit(requests=10, window_seconds=60)),
    _role = Depends(require_workspace_role("manager"))
):
    """
    Uploads and parses inventory.csv.
    """
    org_id = token_context["organization_id"]
    logger.info(f"Inventory Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        if not contents or len(contents) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": "Uploaded file is empty."}
            )
        if len(contents) > MAX_CSV_SIZE_BYTES:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"status": "error", "message": "File size exceeds 10MB limit. Please split your CSV into smaller batches."}
            )
        
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except (pd.errors.EmptyDataError, pd.errors.ParserError) as pe:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": f"Failed to parse CSV file: {str(pe)}"}
            )

        report = ImporterService.import_inventory(db, org_id, df)
        if report["status"] == "error":
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=report)
        return JSONResponse(status_code=status.HTTP_201_CREATED, content=report)
    except Exception as e:
        logger.error(f"Inventory Upload Error: {e}", exc_info=e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Failed to process inventory CSV: {str(e)}"}
        )


@router.post("/upload/sales", status_code=status.HTTP_201_CREATED)
def upload_sales_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant),
    _: None = Depends(rate_limit(requests=10, window_seconds=60)),
    _role = Depends(require_workspace_role("manager"))
):
    """
    Uploads and parses sales.csv.
    """
    org_id = token_context["organization_id"]
    logger.info(f"Sales Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        if not contents or len(contents) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": "Uploaded file is empty."}
            )
        if len(contents) > MAX_CSV_SIZE_BYTES:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"status": "error", "message": "File size exceeds 10MB limit. Please split your CSV into smaller batches."}
            )

        try:
            df = pd.read_csv(io.BytesIO(contents))
        except (pd.errors.EmptyDataError, pd.errors.ParserError) as pe:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": f"Failed to parse CSV file: {str(pe)}"}
            )

        report = ImporterService.import_sales(db, org_id, df)
        if report["status"] == "error":
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=report)
        return JSONResponse(status_code=status.HTTP_201_CREATED, content=report)
    except Exception as e:
        logger.error(f"Sales Upload Error: {e}", exc_info=e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Failed to process sales CSV: {str(e)}"}
        )


@router.post("/upload/costs", status_code=status.HTTP_201_CREATED)
def upload_product_costs_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant),
    _: None = Depends(rate_limit(requests=10, window_seconds=60)),
    _role = Depends(require_workspace_role("manager"))
):
    """
    Uploads and parses product_cost.csv / costs.csv.
    """
    org_id = token_context["organization_id"]
    logger.info(f"Costs Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        if not contents or len(contents) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": "Uploaded file is empty."}
            )
        if len(contents) > MAX_CSV_SIZE_BYTES:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"status": "error", "message": "File size exceeds 10MB limit. Please split your CSV into smaller batches."}
            )

        try:
            df = pd.read_csv(io.BytesIO(contents))
        except (pd.errors.EmptyDataError, pd.errors.ParserError) as pe:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": f"Failed to parse CSV file: {str(pe)}"}
            )

        report = ImporterService.import_costs(db, org_id, df)
        if report["status"] == "error":
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=report)
        return JSONResponse(status_code=status.HTTP_201_CREATED, content=report)
    except Exception as e:
        logger.error(f"Costs Upload Error: {e}", exc_info=e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Failed to process product cost CSV: {str(e)}"}
        )

@router.post("/upload/master", status_code=status.HTTP_201_CREATED)
def upload_master_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant),
    _: None = Depends(rate_limit(requests=10, window_seconds=60)),
    _role = Depends(require_workspace_role("manager"))
):
    """
    Uploads and parses a master CSV (e.g. Shopify export).
    """
    org_id = token_context["organization_id"]
    logger.info(f"Master Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        if not contents or len(contents) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": "Uploaded file is empty."}
            )
        if len(contents) > MAX_CSV_SIZE_BYTES:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"status": "error", "message": "File size exceeds 10MB limit. Please split your CSV into smaller batches."}
            )

        try:
            df = pd.read_csv(io.BytesIO(contents))
        except (pd.errors.EmptyDataError, pd.errors.ParserError) as pe:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"status": "error", "message": f"Failed to parse CSV file: {str(pe)}"}
            )

        report = ImporterService.import_master(db, org_id, df)
        if report["status"] == "error":
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=report)
        return JSONResponse(status_code=status.HTTP_201_CREATED, content=report)
    except Exception as e:
        logger.error(f"Master Upload Error: {e}", exc_info=e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Failed to process master CSV: {str(e)}"}
        )

@router.post("/upload/preview")
def preview_upload_csv(
    file: UploadFile = File(...),
    token_context: dict = Depends(get_current_user_and_tenant),
    _role = Depends(require_workspace_role("manager"))
):
    """
    Parses a CSV to detect apparel variants, returning the grouping preview
    without committing anything to the database.
    """
    try:
        from app.fashion.variant_detector import detect_variants
    except ImportError:
        return JSONResponse(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            content={"status": "error", "message": "Variant detection module not available."}
        )

    try:
        contents = file.file.read()
        if not contents or len(contents) == 0:
            return JSONResponse(status_code=400, content={"status": "error", "message": "File is empty."})
        
        df = pd.read_csv(io.BytesIO(contents))
        df.columns = [c.strip().lower() for c in df.columns]
        
        if "sku" not in df.columns or "name" not in df.columns:
            return JSONResponse(status_code=400, content={"status": "error", "message": "CSV must contain 'sku' and 'name' columns."})
            
        product_list = []
        for _, r in df.iterrows():
            sku_val = str(r.get("sku", "")).strip()
            name_val = str(r.get("name", "")).strip()
            if sku_val and sku_val != "nan":
                product_list.append({"sku": sku_val, "name": name_val})
                
        detection = detect_variants(product_list)
        
        # Serialize result
        result = {
            "detected_variants": [
                {
                    "parent_name": group.parent_name,
                    "parent_id": group.parent_product_id,
                    "variants": [
                        {
                            "sku": v.sku,
                            "name": v.original_name,
                            "color": v.color,
                            "size": v.size
                        } for v in group.variants
                    ],
                    "detected_sizes": group.detected_sizes,
                    "detected_colors": group.detected_colors
                } for group in detection.variant_groups
            ],
            "unmatched_products": detection.unmatched_products,
            "total_products": detection.total_products,
            "total_variants_detected": detection.total_variants_detected,
            "detection_confidence": detection.detection_confidence
        }
        
        return JSONResponse(status_code=200, content=result)
        
    except Exception as e:
        logger.error(f"Preview Upload Error: {e}", exc_info=e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": f"Failed to parse CSV preview: {str(e)}"}
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
            
            # Compute advanced fashion retail metrics
            avg_stock_value = item.stock_on_hand * (prod.unit_cost or 0.0)
            gmroi_val = calculate_gmroi(profit, avg_stock_value)
            sell_through_val = calculate_sell_through_rate(qty_sold, item.stock_on_hand)
            turnover_val = calculate_inventory_turnover(cogs, avg_stock_value)
            
            product_metrics.append({
                "sku": prod.sku,
                "name": prod.name,
                "category": prod.category,
                "stock_on_hand": item.stock_on_hand,
                "unit_cost": prod.unit_cost or 0.0,
                "qty_sold": qty_sold,
                "revenue": round(revenue, 2),
                "profit": round(profit, 2),
                "margin_percent": round(margin, 2),
                "gmroi": gmroi_val,
                "sell_through_rate": sell_through_val,
                "inventory_turnover": turnover_val
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


# ---------------------------------------------------------------------------
# Pydantic request schemas (defined inline — no separate schema file needed)
# ---------------------------------------------------------------------------

class ProductCreateRequest(BaseModel):
    """Request body for manually creating a product and its initial inventory record."""
    sku: str
    name: str
    category: str
    stock_on_hand: int = Field(default=0, ge=0)
    unit_cost: float = Field(default=0.0, ge=0)
    selling_price: float = Field(default=0.0, ge=0)
    reorder_point: int = Field(default=10, ge=0)
    supplier_name: Optional[str] = None


class StockUpdateRequest(BaseModel):
    """Request body for updating a product's stock level."""
    stock_on_hand: int = Field(ge=0)
    reorder_point: Optional[int] = Field(default=None, ge=0)


# ---------------------------------------------------------------------------
# New CRUD / alert endpoints
# ---------------------------------------------------------------------------

@router.post("/product", status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreateRequest,
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant),
    _role = Depends(require_workspace_role("manager"))
):
    """
    Manually create a product and its initial inventory record.
    Validates SKU uniqueness within the workspace before inserting.
    """
    from app.models.inventory import InventoryItem
    org_id = token_context["organization_id"]

    # Prevent duplicate SKUs within the same organization
    existing = db.query(Product).filter(
        Product.organization_id == org_id,
        Product.sku == body.sku
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"SKU '{body.sku}' already exists in this workspace."
        )

    product = Product(
        organization_id=org_id,
        sku=body.sku,
        name=body.name,
        category=body.category,
        unit_cost=body.unit_cost,
        selling_price=body.selling_price,
        supplier_name=body.supplier_name,
    )
    db.add(product)
    db.flush()  # Populate product.id before creating the linked inventory item

    inventory_item = InventoryItem(
        organization_id=org_id,
        product_id=product.id,
        stock_on_hand=body.stock_on_hand,
        reorder_point=body.reorder_point,
    )
    db.add(inventory_item)
    db.commit()
    db.refresh(product)

    return {
        "status": "success",
        "message": f"Product '{body.name}' created.",
        "product_id": str(product.id)
    }


@router.put("/product/{sku}/stock")
def update_product_stock(
    sku: str,
    body: StockUpdateRequest,
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant),
    _role = Depends(require_workspace_role("manager"))
):
    """
    Update stock level (and optionally reorder_point) for a specific SKU.
    """
    from app.models.inventory import InventoryItem
    org_id = token_context["organization_id"]

    product = db.query(Product).filter(
        Product.organization_id == org_id,
        Product.sku == sku
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found.")

    item = db.query(InventoryItem).filter(
        InventoryItem.organization_id == org_id,
        InventoryItem.product_id == product.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory record not found.")

    item.stock_on_hand = body.stock_on_hand
    if body.reorder_point is not None:
        item.reorder_point = body.reorder_point
    db.commit()

    return {"status": "success", "sku": sku, "new_stock": body.stock_on_hand}


@router.get("/alerts")
def get_inventory_alerts(
    db: Session = Depends(get_db),
    token_context: dict = Depends(get_current_user_and_tenant)
):
    """
    Returns two alert categories for the workspace:
    - low_stock: items at or below their reorder_point
    - dead_stock: items with stock > 0 but no sales in the last 30 days
    """
    from sqlalchemy.orm import joinedload
    from app.models.inventory import InventoryItem, SalesRecord

    org_id = token_context["organization_id"]
    thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)

    # Load all inventory items with their associated products
    items = (
        db.query(InventoryItem)
        .options(joinedload(InventoryItem.product))
        .filter(InventoryItem.organization_id == org_id)
        .all()
    )

    # Collect product IDs that have had at least one sale in the last 30 days
    recent_sales_product_ids = (
        db.query(SalesRecord.product_id)
        .filter(
            SalesRecord.organization_id == org_id,
            SalesRecord.date >= thirty_days_ago
        )
        .distinct()
        .all()
    )
    recent_ids = {row[0] for row in recent_sales_product_ids}

    low_stock = []
    dead_stock = []

    for item in items:
        prod = item.product
        if item.stock_on_hand <= item.reorder_point:
            low_stock.append({
                "sku": prod.sku,
                "name": prod.name,
                "category": prod.category,
                "stock_on_hand": item.stock_on_hand,
                "reorder_point": item.reorder_point,
                "shortage": item.reorder_point - item.stock_on_hand
            })
        if item.stock_on_hand > 0 and prod.id not in recent_ids:
            dead_stock.append({
                "sku": prod.sku,
                "name": prod.name,
                "category": prod.category,
                "stock_on_hand": item.stock_on_hand,
                "estimated_value": round(item.stock_on_hand * (prod.unit_cost or 0.0), 2)
            })

    return {
        "low_stock": sorted(low_stock, key=lambda x: x["shortage"], reverse=True),
        "dead_stock": dead_stock,
        "low_stock_count": len(low_stock),
        "dead_stock_count": len(dead_stock)
    }

