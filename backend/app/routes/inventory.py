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
    Supports columns: sku, name, quantity/stock_on_hand, category (optional), lead_time_days (optional)
    """
    org_id = token_context["organization_id"]
    logger.info(f"Inventory Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # Standardize column headers to lowercase
        df.columns = [c.strip().lower() for c in df.columns]

        # Validate minimum required columns
        if "sku" not in df.columns or "name" not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV must contain at least 'sku' and 'name' columns."
            )

        processed_count = 0
        for _, row in df.iterrows():
            sku = str(row["sku"]).strip()
            name = str(row["name"]).strip()
            
            # Flexible column resolution with defaults
            category = str(row.get("category", "General")).strip()
            
            # Resolve stock quantity
            stock = 0
            if "stock_on_hand" in df.columns:
                stock = int(row["stock_on_hand"])
            elif "quantity" in df.columns:
                stock = int(row["quantity"])
            elif "stock" in df.columns:
                stock = int(row["stock"])
                
            lead_time = int(row.get("lead_time_days", 14))

            # 1. Upsert Product record
            product = db.query(Product).filter(
                Product.organization_id == org_id,
                Product.sku == sku
            ).first()

            if not product:
                product = Product(
                    organization_id=org_id,
                    sku=sku,
                    name=name,
                    category=category
                )
                db.add(product)
                db.flush() # Acquire product.id

            product.name = name
            product.category = category

            # 2. Upsert InventoryItem record
            inventory_item = db.query(InventoryItem).filter(
                InventoryItem.organization_id == org_id,
                InventoryItem.product_id == product.id
            ).first()

            if not inventory_item:
                inventory_item = InventoryItem(
                    organization_id=org_id,
                    product_id=product.id
                )
                db.add(inventory_item)

            inventory_item.stock_on_hand = stock
            inventory_item.lead_time_days = lead_time
            processed_count += 1

        db.commit()
        logger.info(f"Inventory Upload: Successfully processed {processed_count} items.")
        return {"status": "success", "message": f"Processed {processed_count} inventory records."}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
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
    Supports columns: sku, date, quantity/qty, unit_price/price (optional), revenue/sales (optional)
    """
    org_id = token_context["organization_id"]
    logger.info(f"Sales Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # Standardize column headers to lowercase
        df.columns = [c.strip().lower() for c in df.columns]

        # Validate required columns
        if "sku" not in df.columns or "date" not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV must contain 'sku' and 'date' columns."
            )

        processed_count = 0
        for _, row in df.iterrows():
            sku = str(row["sku"]).strip()
            date_str = str(row["date"]).strip()
            
            # Resolve quantity
            quantity = 0
            if "quantity" in df.columns:
                quantity = int(row["quantity"])
            elif "qty" in df.columns:
                quantity = int(row["qty"])

            # Parse date
            try:
                date_val = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid date format: {date_str}. Must be YYYY-MM-DD."
                )

            # Locate product
            product = db.query(Product).filter(
                Product.organization_id == org_id,
                Product.sku == sku
            ).first()

            if not product:
                product = Product(
                    organization_id=org_id,
                    sku=sku,
                    name=f"Product {sku}",
                    category="General"
                )
                db.add(product)
                db.flush()

            # Resolve price. If missing in CSV, check if we have a selling_price stored in the Product record.
            price = 0.0
            if "unit_price" in df.columns:
                price = float(row["unit_price"])
            elif "price" in df.columns:
                price = float(row["price"])
            elif "selling_price" in df.columns:
                price = float(row["selling_price"])
            else:
                price = product.selling_price if product.selling_price > 0 else 50.0

            # Resolve revenue
            revenue = 0.0
            if "revenue" in df.columns:
                revenue = float(row["revenue"])
            elif "sales" in df.columns:
                revenue = float(row["sales"])
            else:
                revenue = quantity * price

            # Record sales record (Append-only transaction)
            sales_record = SalesRecord(
                organization_id=org_id,
                product_id=product.id,
                date=date_val,
                quantity=quantity,
                unit_price=price,
                revenue=revenue
            )
            db.add(sales_record)
            processed_count += 1

        db.commit()
        logger.info(f"Sales Upload: Successfully processed {processed_count} sales transactions.")
        return {"status": "success", "message": f"Recorded {processed_count} sales transactions."}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
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
    Supports columns: sku, unit_cost/cost, selling_price/price (optional), supplier_name/supplier (optional)
    """
    org_id = token_context["organization_id"]
    logger.info(f"Costs Upload: Received file '{file.filename}' from tenant Org: {org_id}")

    try:
        contents = file.file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # Standardize column headers to lowercase
        df.columns = [c.strip().lower() for c in df.columns]

        # Validate required columns
        if "sku" not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV must contain 'sku' column."
            )

        processed_count = 0
        for _, row in df.iterrows():
            sku = str(row["sku"]).strip()
            
            # Resolve cost
            unit_cost = 0.0
            if "unit_cost" in df.columns:
                unit_cost = float(row["unit_cost"])
            elif "cost" in df.columns:
                unit_cost = float(row["cost"])

            # Resolve selling price
            selling_price = 0.0
            if "selling_price" in df.columns:
                selling_price = float(row["selling_price"])
            elif "price" in df.columns:
                selling_price = float(row["price"])

            # Resolve supplier name
            supplier_name = "Default Supplier"
            if "supplier_name" in df.columns:
                supplier_name = str(row["supplier_name"]).strip()
            elif "supplier" in df.columns:
                supplier_name = str(row["supplier"]).strip()
            elif "vendor" in df.columns:
                supplier_name = str(row["vendor"]).strip()

            # Locate product
            product = db.query(Product).filter(
                Product.organization_id == org_id,
                Product.sku == sku
            ).first()

            if not product:
                product = Product(
                    organization_id=org_id,
                    sku=sku,
                    name=f"Product {sku}",
                    category="General"
                )
                db.add(product)
                db.flush()

            # Update product costs
            product.unit_cost = unit_cost
            if selling_price > 0:
                product.selling_price = selling_price
            product.supplier_name = supplier_name
            processed_count += 1

        db.commit()
        logger.info(f"Costs Upload: Successfully processed costs for {processed_count} products.")
        return {"status": "success", "message": f"Updated costs for {processed_count} products."}

    except Exception as e:
        db.rollback()
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
