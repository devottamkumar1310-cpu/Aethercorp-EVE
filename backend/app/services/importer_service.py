import logging
import io
import datetime
import pandas as pd
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.models.organization import Membership
from app.models.supplier import Supplier

logger = logging.getLogger("eve.services.importer_service")

class ImporterService:
    """
    Extensible service for validating, transforming, and importing business datasets
    into EVE's tenant-scoped database structure. Designed to evolve into a user-facing
    import module.
    """

    @staticmethod
    def validate_schema(df: pd.DataFrame, required_fields: List[str]) -> Tuple[bool, List[str]]:
        """
        Validates that a DataFrame contains the required header fields (case-insensitive).
        Returns (is_valid, missing_fields).
        """
        df.columns = [c.strip().lower() for c in df.columns]
        missing = [f for f in required_fields if f not in df.columns]
        return len(missing) == 0, missing

    @classmethod
    def import_inventory(cls, db: Session, org_id: Any, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Ingests product catalog and current stock levels.
        Required: sku, name
        Optional: category, stock_on_hand/quantity/stock, lead_time_days
        """
        # Standardize columns
        df.columns = [c.strip().lower() for c in df.columns]
        is_valid, missing = cls.validate_schema(df, ["sku", "name"])
        if not is_valid:
            raise ValueError(f"Missing required inventory fields: {missing}")

        # Cache existing products and inventory items
        products_cache = {p.sku: p for p in db.query(Product).filter(Product.organization_id == org_id).all()}
        
        # We need product IDs for existing inventory items
        existing_items = db.query(InventoryItem).filter(InventoryItem.organization_id == org_id).all()
        inventory_cache = {item.product_id: item for item in existing_items}

        success_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                sku = str(row["sku"]).strip()
                name = str(row["name"]).strip()
                category = str(row.get("category", "General")).strip()
                
                # Resolve stock on hand using multiple aliases
                stock = 0
                for alias in ["stock_on_hand", "quantity", "stock"]:
                    if alias in df.columns:
                        stock = int(row[alias])
                        break
                        
                lead_time = int(row.get("lead_time_days", 14))

                # 1. Upsert Product
                product = products_cache.get(sku)

                if not product:
                    product = Product(
                        organization_id=org_id,
                        sku=sku,
                        name=name,
                        category=category,
                        selling_price=50.0,
                        unit_cost=20.0
                    )
                    db.add(product)
                    db.flush()
                    products_cache[sku] = product

                product.name = name
                product.category = category

                # 2. Upsert InventoryItem
                inventory_item = inventory_cache.get(product.id)

                if not inventory_item:
                    inventory_item = InventoryItem(
                        organization_id=org_id,
                        product_id=product.id
                    )
                    db.add(inventory_item)
                    db.flush()
                    inventory_cache[product.id] = inventory_item

                inventory_item.stock_on_hand = stock
                inventory_item.lead_time_days = lead_time
                inventory_item.reorder_point = max(5, int(stock * 0.1)) # default reorder point rule
                
                success_count += 1

            except Exception as e:
                logger.error(f"Error importing inventory row {index}: {e}")
                errors.append({"row": index, "error": str(e)})

        if errors:
            db.rollback()
            return {"status": "error", "processed_count": 0, "errors": errors}
        
        db.commit()
        return {"status": "success", "processed_count": success_count, "errors": []}

    @classmethod
    def import_sales(cls, db: Session, org_id: Any, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Ingests order sales logs.
        Required: sku, date, quantity/qty
        Optional: unit_price/price, revenue/sales
        """
        df.columns = [c.strip().lower() for c in df.columns]
        is_valid, missing = cls.validate_schema(df, ["sku", "date"])
        if not is_valid:
            raise ValueError(f"Missing required sales fields: {missing}")

        # Cache existing products
        products_cache = {p.sku: p for p in db.query(Product).filter(Product.organization_id == org_id).all()}

        success_count = 0
        errors = []
        sales_to_add = []

        for index, row in df.iterrows():
            try:
                sku = str(row["sku"]).strip()
                date_str = str(row["date"]).strip()
                
                # Resolve quantity
                quantity = 0
                for alias in ["quantity", "qty"]:
                    if alias in df.columns:
                        quantity = int(row[alias])
                        break

                # Resolve date format
                for date_fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%d/%m/%Y"]:
                    try:
                        date_val = datetime.datetime.strptime(date_str, date_fmt).date()
                        break
                    except ValueError:
                        continue
                else:
                    raise ValueError(f"Unable to parse date: {date_str}")

                # Find product mapping or mock create
                product = products_cache.get(sku)

                if not product:
                    product = Product(
                        organization_id=org_id,
                        sku=sku,
                        name=f"Product {sku}",
                        category="General",
                        selling_price=50.0,
                        unit_cost=20.0
                    )
                    db.add(product)
                    db.flush()
                    products_cache[sku] = product

                # Resolve price
                price = product.selling_price
                for alias in ["unit_price", "price", "selling_price"]:
                    if alias in df.columns:
                        price = float(row[alias])
                        break

                # Resolve revenue
                revenue = quantity * price
                for alias in ["revenue", "sales"]:
                    if alias in df.columns:
                        revenue = float(row[alias])
                        break

                # Create sales record
                sales_record = SalesRecord(
                    organization_id=org_id,
                    product_id=product.id,
                    date=date_val,
                    quantity=quantity,
                    unit_price=price,
                    revenue=revenue
                )
                sales_to_add.append(sales_record)
                success_count += 1

            except Exception as e:
                logger.error(f"Error importing sales row {index}: {e}")
                errors.append({"row": index, "error": str(e)})

        if errors:
            db.rollback()
            return {"status": "error", "processed_count": 0, "errors": errors}

        if sales_to_add:
            db.add_all(sales_to_add)
        db.commit()
        return {"status": "success", "processed_count": success_count, "errors": []}

    @classmethod
    def import_costs(cls, db: Session, org_id: Any, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Ingests supplier and product cost profiles.
        Required: sku, unit_cost/cost
        Optional: selling_price/price, supplier_name/supplier
        """
        df.columns = [c.strip().lower() for c in df.columns]
        is_valid, missing = cls.validate_schema(df, ["sku"])
        if not is_valid:
            raise ValueError(f"Missing required cost fields: {missing}")

        # Cache existing products and suppliers
        products_cache = {p.sku: p for p in db.query(Product).filter(Product.organization_id == org_id).all()}
        suppliers_cache = {s.name: s for s in db.query(Supplier).filter(Supplier.organization_id == org_id).all()}

        success_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                sku = str(row["sku"]).strip()
                
                # Resolve cost
                unit_cost = 0.0
                for alias in ["unit_cost", "cost"]:
                    if alias in df.columns:
                        unit_cost = float(row[alias])
                        break

                # Resolve selling price
                selling_price = 0.0
                for alias in ["selling_price", "price"]:
                    if alias in df.columns:
                        selling_price = float(row[alias])
                        break

                # Resolve supplier name
                supplier_name = "Default Supplier"
                for alias in ["supplier_name", "supplier", "vendor"]:
                    if alias in df.columns:
                        supplier_name = str(row[alias]).strip()
                        break

                # Find product mapping or mock create
                product = products_cache.get(sku)

                if not product:
                    product = Product(
                        organization_id=org_id,
                        sku=sku,
                        name=f"Product {sku}",
                        category="General"
                    )
                    db.add(product)
                    db.flush()
                    products_cache[sku] = product

                product.unit_cost = unit_cost
                if selling_price > 0:
                    product.selling_price = selling_price
                product.supplier_name = supplier_name
                
                # Upsert supplier entity
                supplier = suppliers_cache.get(supplier_name)

                if not supplier:
                    supplier = Supplier(
                        organization_id=org_id,
                        name=supplier_name,
                        location="Domestic",
                        lead_time_days=15,
                        minimum_order_qty=50,
                        reliability_score=0.95
                    )
                    db.add(supplier)
                    db.flush()
                    suppliers_cache[supplier_name] = supplier

                success_count += 1

            except Exception as e:
                logger.error(f"Error importing costs row {index}: {e}")
                errors.append({"row": index, "error": str(e)})

        if errors:
            db.rollback()
            return {"status": "error", "processed_count": 0, "errors": errors}

        db.commit()
        return {"status": "success", "processed_count": success_count, "errors": []}
