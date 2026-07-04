import logging
import datetime
import pandas as pd
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
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
        Ingests product catalog and current stock levels with strict validation.
        Required: sku, name
        Optional: category, stock_on_hand/quantity/stock, lead_time_days
        """
        import uuid
        if isinstance(org_id, str):
            try:
                org_id = uuid.UUID(org_id)
            except ValueError:
                pass
        original_cols = list(df.columns)
        df.columns = [c.strip().lower() for c in df.columns]
        
        # 1. Missing columns validation
        is_valid, missing = cls.validate_schema(df, ["sku", "name"])
        if not is_valid:
            return {
                "status": "error",
                "total_rows": len(df),
                "valid_rows": 0,
                "invalid_rows": len(df),
                "duplicate_rows": 0,
                "missing_columns": missing,
                "errors": [{"row": 0, "column": "headers", "value": None, "message": f"Missing required columns: {missing}"}]
            }

        errors = []
        total_rows = len(df)
        df = df.reset_index(drop=True)
        
        # 2. Duplicate rows validation (check duplicate SKUs in the CSV file itself)
        duplicate_rows_count = 0
        if "sku" in df.columns:
            duplicates = df.duplicated(subset=["sku"], keep=False)
            duplicate_rows_count = df.duplicated(subset=["sku"], keep="first").sum()
            
        for index, row in df.iterrows():
            row_num = index + 1
            
            # Check SKU duplicate
            if "sku" in df.columns and duplicates.iloc[index]:
                errors.append({
                    "row": row_num,
                    "column": "sku",
                    "value": str(row.get("sku")),
                    "message": "Duplicate SKU value in import file."
                })
                continue
                
            # SKU and Name validations
            sku_val = row.get("sku")
            if pd.isna(sku_val) or str(sku_val).strip() == "":
                errors.append({"row": row_num, "column": "sku", "value": None, "message": "SKU cannot be empty."})
                continue
            
            name_val = row.get("name")
            if pd.isna(name_val) or str(name_val).strip() == "":
                errors.append({"row": row_num, "column": "name", "value": None, "message": "Product Name cannot be empty."})
                continue

            # Stock level validations
            stock_found = False
            for alias in ["stock_on_hand", "quantity", "stock"]:
                if alias in df.columns:
                    stock_val = row[alias]
                    stock_found = True
                    if pd.isna(stock_val):
                        errors.append({"row": row_num, "column": alias, "value": None, "message": "Stock level cannot be empty."})
                    else:
                        try:
                            val = int(stock_val)
                            if val < 0:
                                errors.append({"row": row_num, "column": alias, "value": str(stock_val), "message": "Stock level cannot be negative."})
                        except (ValueError, TypeError):
                            errors.append({"row": row_num, "column": alias, "value": str(stock_val), "message": "Stock level must be a valid integer."})
                    break
            
            # Lead time validations
            if "lead_time_days" in df.columns:
                lt_val = row["lead_time_days"]
                if not pd.isna(lt_val):
                    try:
                        val = int(lt_val)
                        if val < 0:
                            errors.append({"row": row_num, "column": "lead_time_days", "value": str(lt_val), "message": "Lead time cannot be negative."})
                    except (ValueError, TypeError):
                        errors.append({"row": row_num, "column": "lead_time_days", "value": str(lt_val), "message": "Lead time must be a valid integer."})

        if errors:
            return {
                "status": "error",
                "total_rows": total_rows,
                "valid_rows": total_rows - len(errors),
                "invalid_rows": len(errors),
                "duplicate_rows": int(duplicate_rows_count),
                "missing_columns": [],
                "errors": errors
            }

        # Pass 2: Upsert records
        products_cache = {p.sku: p for p in db.query(Product).filter(Product.organization_id == org_id).all()}
        existing_items = db.query(InventoryItem).filter(InventoryItem.organization_id == org_id).all()
        inventory_cache = {item.product_id: item for item in existing_items}
        
        success_count = 0
        for index, row in df.iterrows():
            sku = str(row["sku"]).strip()
            name = str(row["name"]).strip()
            category = str(row.get("category", "General")).strip()
            
            stock = 0
            for alias in ["stock_on_hand", "quantity", "stock"]:
                if alias in df.columns:
                    stock = int(row[alias])
                    break
                    
            lead_time = int(row.get("lead_time_days", 14))
            
            product = products_cache.get(sku)
            if not product:
                product = Product(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    sku=sku,
                    name=name,
                    category=category,
                    selling_price=50.0,
                    unit_cost=20.0
                )
                db.add(product)
                products_cache[sku] = product
            else:
                product.name = name
                product.category = category
                
            inventory_item = inventory_cache.get(product.id)
            if not inventory_item:
                inventory_item = InventoryItem(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    product_id=product.id
                )
                db.add(inventory_item)
                inventory_cache[product.id] = inventory_item
                
            inventory_item.stock_on_hand = stock
            inventory_item.lead_time_days = lead_time
            inventory_item.reorder_point = max(5, int(stock * 0.1))
            success_count += 1
            
        db.commit()
        return {
            "status": "success",
            "processed_count": success_count,
            "total_rows": total_rows,
            "valid_rows": total_rows,
            "invalid_rows": 0,
            "duplicate_rows": int(duplicate_rows_count),
            "missing_columns": [],
            "errors": []
        }

    @classmethod
    def import_sales(cls, db: Session, org_id: Any, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Ingests order sales logs with strict validation.
        Required: sku, date, quantity/qty
        Optional: unit_price/price, revenue/sales
        """
        import uuid
        if isinstance(org_id, str):
            try:
                org_id = uuid.UUID(org_id)
            except ValueError:
                pass
        original_cols = list(df.columns)
        df.columns = [c.strip().lower() for c in df.columns]
        
        # 1. Schema check
        is_valid, missing = cls.validate_schema(df, ["sku", "date"])
        if not is_valid:
            return {
                "status": "error",
                "total_rows": len(df),
                "valid_rows": 0,
                "invalid_rows": len(df),
                "duplicate_rows": 0,
                "missing_columns": missing,
                "errors": [{"row": 0, "column": "headers", "value": None, "message": f"Missing required columns: {missing}"}]
            }

        # Check quantity column is present
        qty_cols = [c for c in ["quantity", "qty"] if c in df.columns]
        if not qty_cols:
            return {
                "status": "error",
                "total_rows": len(df),
                "valid_rows": 0,
                "invalid_rows": len(df),
                "duplicate_rows": 0,
                "missing_columns": ["quantity/qty"],
                "errors": [{"row": 0, "column": "headers", "value": None, "message": "Missing quantity or qty column."}]
            }
        qty_col = qty_cols[0]

        errors = []
        total_rows = len(df)
        df = df.reset_index(drop=True)
        
        # Check duplicate rows (exact duplicate order lines in CSV)
        duplicate_rows_count = df.duplicated().sum()
        
        # Pass 1: Validations
        parsed_dates = {}
        for index, row in df.iterrows():
            row_num = index + 1
            
            sku_val = row.get("sku")
            if pd.isna(sku_val) or str(sku_val).strip() == "":
                errors.append({"row": row_num, "column": "sku", "value": None, "message": "SKU cannot be empty."})
                continue
                
            date_val = row.get("date")
            if pd.isna(date_val) or str(date_val).strip() == "":
                errors.append({"row": row_num, "column": "date", "value": None, "message": "Date cannot be empty."})
                continue
                
            # Date validation
            date_str = str(date_val).strip()
            parsed_date = None
            for date_fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%d/%m/%Y"]:
                try:
                    parsed_date = datetime.datetime.strptime(date_str, date_fmt).date()
                    break
                except ValueError:
                    continue
            if parsed_date is None:
                errors.append({"row": row_num, "column": "date", "value": date_str, "message": f"Unable to parse date: '{date_str}'."})
            else:
                parsed_dates[index] = parsed_date
            
            # Quantity validation
            qty_val = row[qty_col]
            if pd.isna(qty_val):
                errors.append({"row": row_num, "column": qty_col, "value": None, "message": "Quantity cannot be empty."})
            else:
                try:
                    val = int(qty_val)
                    if val < 0:
                        errors.append({"row": row_num, "column": qty_col, "value": str(qty_val), "message": "Quantity cannot be negative."})
                except (ValueError, TypeError):
                    errors.append({"row": row_num, "column": qty_col, "value": str(qty_val), "message": "Quantity must be an integer."})

            # Unit Price validation (if exists)
            price_found = False
            for alias in ["unit_price", "price", "selling_price"]:
                if alias in df.columns:
                    p_val = row[alias]
                    price_found = True
                    if not pd.isna(p_val):
                        try:
                            val = float(p_val)
                            if val < 0:
                                errors.append({"row": row_num, "column": alias, "value": str(p_val), "message": "Price cannot be negative."})
                        except (ValueError, TypeError):
                            errors.append({"row": row_num, "column": alias, "value": str(p_val), "message": "Price must be a valid float value."})
                    break

            # Revenue validation (if exists)
            for alias in ["revenue", "sales"]:
                if alias in df.columns:
                    r_val = row[alias]
                    if not pd.isna(r_val):
                        try:
                            val = float(r_val)
                            if val < 0:
                                errors.append({"row": row_num, "column": alias, "value": str(r_val), "message": "Revenue cannot be negative."})
                        except (ValueError, TypeError):
                            errors.append({"row": row_num, "column": alias, "value": str(r_val), "message": "Revenue must be a valid float value."})
                    break

        if errors:
            return {
                "status": "error",
                "total_rows": total_rows,
                "valid_rows": total_rows - len(errors),
                "invalid_rows": len(errors),
                "duplicate_rows": int(duplicate_rows_count),
                "missing_columns": [],
                "errors": errors
            }

        # Pass 2: Save to DB
        products_cache = {p.sku: p for p in db.query(Product).filter(Product.organization_id == org_id).all()}
        sales_to_add = []
        success_count = 0
        
        for index, row in df.iterrows():
            sku = str(row["sku"]).strip()
            date_val = parsed_dates[index]
            quantity = int(row[qty_col])
            
            product = products_cache.get(sku)
            if not product:
                product = Product(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    sku=sku,
                    name=f"Product {sku}",
                    category="General",
                    selling_price=50.0,
                    unit_cost=20.0
                )
                db.add(product)
                products_cache[sku] = product
                
            price = product.selling_price
            for alias in ["unit_price", "price", "selling_price"]:
                if alias in df.columns:
                    if not pd.isna(row[alias]):
                        price = float(row[alias])
                        break
                        
            revenue = quantity * price
            for alias in ["revenue", "sales"]:
                if alias in df.columns:
                    if not pd.isna(row[alias]):
                        revenue = float(row[alias])
                        break
                        
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
            
        if sales_to_add:
            db.add_all(sales_to_add)
        db.commit()
        return {
            "status": "success",
            "processed_count": success_count,
            "total_rows": total_rows,
            "valid_rows": total_rows,
            "invalid_rows": 0,
            "duplicate_rows": int(duplicate_rows_count),
            "missing_columns": [],
            "errors": []
        }

    @classmethod
    def import_costs(cls, db: Session, org_id: Any, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Ingests supplier and product cost profiles with strict validation.
        Required: sku
        Optional: unit_cost/cost, selling_price/price, supplier_name/supplier
        """
        import uuid
        if isinstance(org_id, str):
            try:
                org_id = uuid.UUID(org_id)
            except ValueError:
                pass
        original_cols = list(df.columns)
        df.columns = [c.strip().lower() for c in df.columns]
        
        # 1. Schema Check
        is_valid, missing = cls.validate_schema(df, ["sku"])
        if not is_valid:
            return {
                "status": "error",
                "total_rows": len(df),
                "valid_rows": 0,
                "invalid_rows": len(df),
                "duplicate_rows": 0,
                "missing_columns": missing,
                "errors": [{"row": 0, "column": "headers", "value": None, "message": f"Missing required columns: {missing}"}]
            }

        # Check at least one cost field is present
        cost_cols = [c for c in ["unit_cost", "cost"] if c in df.columns]
        if not cost_cols:
            return {
                "status": "error",
                "total_rows": len(df),
                "valid_rows": 0,
                "invalid_rows": len(df),
                "duplicate_rows": 0,
                "missing_columns": ["unit_cost/cost"],
                "errors": [{"row": 0, "column": "headers", "value": None, "message": "Missing unit_cost or cost column."}]
            }
        cost_col = cost_cols[0]

        errors = []
        total_rows = len(df)
        df = df.reset_index(drop=True)
        
        # Check duplicate rows
        duplicate_rows_count = 0
        if "sku" in df.columns:
            duplicates = df.duplicated(subset=["sku"], keep=False)
            duplicate_rows_count = df.duplicated(subset=["sku"], keep="first").sum()

        for index, row in df.iterrows():
            row_num = index + 1
            
            # Check SKU duplicate
            if "sku" in df.columns and duplicates.iloc[index]:
                errors.append({
                    "row": row_num,
                    "column": "sku",
                    "value": str(row.get("sku")),
                    "message": "Duplicate SKU value in import file."
                })
                continue
                
            sku_val = row.get("sku")
            if pd.isna(sku_val) or str(sku_val).strip() == "":
                errors.append({"row": row_num, "column": "sku", "value": None, "message": "SKU cannot be empty."})
                continue
                
            # Cost validation
            c_val = row[cost_col]
            if pd.isna(c_val):
                errors.append({"row": row_num, "column": cost_col, "value": None, "message": "Cost value cannot be empty."})
            else:
                try:
                    val = float(c_val)
                    if val < 0:
                        errors.append({"row": row_num, "column": cost_col, "value": str(c_val), "message": "Unit cost cannot be negative."})
                except (ValueError, TypeError):
                    errors.append({"row": row_num, "column": cost_col, "value": str(c_val), "message": "Unit cost must be a valid float value."})

            # Selling Price validation (if exists)
            for alias in ["selling_price", "price"]:
                if alias in df.columns:
                    sp_val = row[alias]
                    if not pd.isna(sp_val):
                        try:
                            val = float(sp_val)
                            if val < 0:
                                errors.append({"row": row_num, "column": alias, "value": str(sp_val), "message": "Selling price cannot be negative."})
                        except (ValueError, TypeError):
                            errors.append({"row": row_num, "column": alias, "value": str(sp_val), "message": "Selling price must be a valid float value."})
                    break

            # Supplier name validation (if exists)
            for alias in ["supplier_name", "supplier", "vendor"]:
                if alias in df.columns:
                    s_val = row[alias]
                    if not pd.isna(s_val) and str(s_val).strip() == "":
                        errors.append({"row": row_num, "column": alias, "value": "", "message": "Supplier name cannot be empty."})
                    break

        if errors:
            return {
                "status": "error",
                "total_rows": total_rows,
                "valid_rows": total_rows - len(errors),
                "invalid_rows": len(errors),
                "duplicate_rows": int(duplicate_rows_count),
                "missing_columns": [],
                "errors": errors
            }

        # Pass 2: Save to DB
        products_cache = {p.sku: p for p in db.query(Product).filter(Product.organization_id == org_id).all()}
        suppliers_cache = {s.name: s for s in db.query(Supplier).filter(Supplier.organization_id == org_id).all()}
        success_count = 0
        
        for index, row in df.iterrows():
            sku = str(row["sku"]).strip()
            unit_cost = float(row[cost_col])
            
            selling_price = 0.0
            for alias in ["selling_price", "price"]:
                if alias in df.columns:
                    if not pd.isna(row[alias]):
                        selling_price = float(row[alias])
                        break
                        
            supplier_name = "Default Supplier"
            for alias in ["supplier_name", "supplier", "vendor"]:
                if alias in df.columns:
                    if not pd.isna(row[alias]):
                        supplier_name = str(row[alias]).strip()
                        break
                        
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
            
        db.commit()
        return {
            "status": "success",
            "processed_count": success_count,
            "total_rows": total_rows,
            "valid_rows": total_rows,
            "invalid_rows": 0,
            "duplicate_rows": int(duplicate_rows_count),
            "missing_columns": [],
            "errors": []
        }

    @classmethod
    def import_master(cls, db: Session, org_id: Any, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Unified ingestion: parses sku, name, quantity, cost, price, date, supplier.
        """
        import uuid
        if isinstance(org_id, str):
            try:
                org_id = uuid.UUID(org_id)
            except ValueError:
                pass
        
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        
        # Mapping common aliases
        col_map = {}
        for c in df.columns:
            if c in ["item_name", "product_name", "product"]: col_map[c] = "name"
            elif c in ["stock_on_hand", "stock", "inventory_quantity"]: col_map[c] = "quantity"
            elif c in ["cost", "unit_cost"]: col_map[c] = "unit_cost"
            elif c in ["price", "selling_price"]: col_map[c] = "selling_price"
            elif c in ["vendor", "supplier_name"]: col_map[c] = "supplier"
            elif c in ["sales_qty", "sold_qty", "qty_sold"]: col_map[c] = "sales_quantity"
        df.rename(columns=col_map, inplace=True)

        is_valid, missing = cls.validate_schema(df, ["sku"])
        if not is_valid:
            return {
                "status": "error", "total_rows": len(df), "valid_rows": 0, "invalid_rows": len(df),
                "duplicate_rows": 0, "missing_columns": missing,
                "errors": [{"row": 0, "column": "headers", "value": None, "message": f"Missing required columns: {missing}"}]
            }

        total_rows = len(df)
        df = df.reset_index(drop=True)
        
        products_cache = {p.sku: p for p in db.query(Product).filter(Product.organization_id == org_id).all()}
        existing_items = db.query(InventoryItem).filter(InventoryItem.organization_id == org_id).all()
        inventory_cache = {item.product_id: item for item in existing_items}
        suppliers_cache = {s.name: s for s in db.query(Supplier).filter(Supplier.organization_id == org_id).all()}
        
        sales_to_add = []
        success_count = 0
        
        for index, row in df.iterrows():
            sku = str(row.get("sku")).strip()
            if not sku or sku == "nan": continue
            
            # Upsert Product
            product = products_cache.get(sku)
            if not product:
                product = Product(
                    id=uuid.uuid4(), organization_id=org_id, sku=sku,
                    name=str(row.get("name", f"Product {sku}")).strip() or f"Product {sku}",
                    category=str(row.get("category", "General")).strip() or "General",
                    selling_price=50.0, unit_cost=20.0
                )
                db.add(product)
                db.flush()
                products_cache[sku] = product
            else:
                if "name" in df.columns and not pd.isna(row["name"]): product.name = str(row["name"]).strip()
                if "category" in df.columns and not pd.isna(row["category"]): product.category = str(row["category"]).strip()
            
            if "unit_cost" in df.columns and not pd.isna(row["unit_cost"]): product.unit_cost = float(row["unit_cost"])
            if "selling_price" in df.columns and not pd.isna(row["selling_price"]): product.selling_price = float(row["selling_price"])
            
            # Upsert Inventory Item
            inventory_item = inventory_cache.get(product.id)
            if not inventory_item:
                inventory_item = InventoryItem(id=uuid.uuid4(), organization_id=org_id, product_id=product.id)
                db.add(inventory_item)
                inventory_cache[product.id] = inventory_item
            
            if "quantity" in df.columns and not pd.isna(row["quantity"]):
                inventory_item.stock_on_hand = int(row["quantity"])
                inventory_item.reorder_point = max(5, int(inventory_item.stock_on_hand * 0.1))
                
            # Sales Record
            if "date" in df.columns and ("sales_quantity" in df.columns or "quantity" in df.columns):
                date_val = row.get("date")
                if not pd.isna(date_val):
                    try:
                        if isinstance(date_val, str):
                            parsed_date = pd.to_datetime(date_val).date()
                        else:
                            parsed_date = date_val.date()
                        
                        sales_qty_col = "sales_quantity" if "sales_quantity" in df.columns else "quantity"
                        sqty = int(row[sales_qty_col])
                        if sqty > 0:
                            rev = sqty * product.selling_price
                            if "revenue" in df.columns and not pd.isna(row["revenue"]):
                                rev = float(row["revenue"])
                            sales_record = SalesRecord(
                                organization_id=org_id, product_id=product.id,
                                date=parsed_date, quantity=sqty,
                                unit_price=product.selling_price, revenue=rev
                            )
                            sales_to_add.append(sales_record)
                    except Exception:
                        pass # Ignore row level sales parsing errors for MVP
            
            success_count += 1
            
        if sales_to_add:
            db.add_all(sales_to_add)
            
        db.commit()
        return {
            "status": "success", "processed_count": success_count, "total_rows": total_rows,
            "valid_rows": total_rows, "invalid_rows": 0, "duplicate_rows": 0,
            "missing_columns": [], "errors": []
        }
