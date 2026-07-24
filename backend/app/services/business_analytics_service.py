import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from app.models.inventory import InventoryItem
from app.models.product import Product
from app.models.supplier import Supplier

class BusinessAnalyticsService:
    @staticmethod
    def get_overview(db: Session, organization_id: uuid.UUID) -> dict:
        """
        Aggregates KPIs for the Business Operations Engine.
        Designed to be easily extensible for future metrics.
        """
        # Client Metrics
        total_clients = db.query(Client).filter(Client.organization_id == organization_id).count()
        active_clients = db.query(Client).filter(Client.organization_id == organization_id, Client.status == "active").count()
        
        # Project Metrics
        total_projects = db.query(Project).filter(Project.organization_id == organization_id).count()
        active_projects = db.query(Project).filter(Project.organization_id == organization_id, Project.status == "active").count()
        
        # Task Metrics
        total_tasks = db.query(Task).filter(Task.organization_id == organization_id).count()
        completed_tasks = db.query(Task).filter(Task.organization_id == organization_id, Task.status == "completed").count()
        
        # Financial Metrics
        total_revenue = db.query(func.sum(Revenue.amount)).filter(Revenue.organization_id == organization_id).scalar() or 0.0
        total_expenses = db.query(func.sum(Expense.amount)).filter(Expense.organization_id == organization_id).scalar() or 0.0
        net_profit = total_revenue - total_expenses
        
        # Inventory Metrics
        total_products = db.query(Product).filter(Product.organization_id == organization_id).count()
        total_items = db.query(InventoryItem).filter(InventoryItem.organization_id == organization_id).count()
        total_inventory = max(total_products, total_items)

        # Supplier / Supply Chain Metrics
        total_suppliers = db.query(Supplier).filter(Supplier.organization_id == organization_id).count()
        
        return {
            "clients": total_clients,
            "active_clients": active_clients,
            "projects": total_projects,
            "active_projects": active_projects,
            "tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "revenue": total_revenue,
            "expenses": total_expenses,
            "profit": net_profit,
            "inventory": total_inventory,
            "suppliers": total_suppliers
        }

    @staticmethod
    def get_product_analytics(db: Session, organization_id: uuid.UUID) -> dict:
        """
        Calculates category breakdown, dead stock items, and low-margin alerts for D2C apparel.
        """
        from app.models.inventory import InventoryItem, SalesRecord
        from sqlalchemy import func
        from sqlalchemy.orm import joinedload
        
        # 1. Fetch inventory items with eager loading of products
        items = db.query(InventoryItem).options(joinedload(InventoryItem.product)).filter(InventoryItem.organization_id == organization_id).all()
        
        # 2. Fetch sales aggregates
        sales_data = db.query(
            SalesRecord.product_id,
            func.sum(SalesRecord.quantity).label("total_qty"),
            func.sum(SalesRecord.revenue).label("total_rev")
        ).filter(SalesRecord.organization_id == organization_id)\
         .group_by(SalesRecord.product_id).all()
        
        sales_map = {row.product_id: {"qty": int(row.total_qty or 0), "rev": float(row.total_rev or 0.0)} for row in sales_data}
        
        # 3. Calculate category breakdown, dead stock, and low margin
        category_stats = {}
        dead_stock = []
        low_margin = []
        
        for item in items:
            prod = item.product
            sales = sales_map.get(prod.id, {"qty": 0, "rev": 0.0})
            qty_sold = sales["qty"]
            revenue = sales["rev"]
            cogs = qty_sold * (prod.unit_cost or 0.0)
            profit = revenue - cogs
            
            # Dead Stock: stock on hand > 0 but zero sales in active transactions
            if item.stock_on_hand > 0 and qty_sold == 0:
                dead_stock.append({
                    "sku": prod.sku,
                    "name": prod.name,
                    "stock_on_hand": item.stock_on_hand,
                    "unit_cost": prod.unit_cost or 0.0
                })
                
            # Category Breakdown
            cat = prod.category or "Uncategorized"
            if cat not in category_stats:
                category_stats[cat] = {"qty_sold": 0, "revenue": 0.0, "cogs": 0.0, "items_count": 0}
            category_stats[cat]["qty_sold"] += qty_sold
            category_stats[cat]["revenue"] += revenue
            category_stats[cat]["cogs"] += cogs
            category_stats[cat]["items_count"] += 1
            
            # Low Margin check (unit cost vs selling price)
            price = prod.selling_price or 0.0
            cost = prod.unit_cost or 0.0
            unit_margin = (price - cost) / price if price > 0.0 else 0.0
            if unit_margin < 0.15 and item.stock_on_hand > 0:
                low_margin.append({
                    "sku": prod.sku,
                    "name": prod.name,
                    "selling_price": price,
                    "unit_cost": cost,
                    "margin_percent": round(unit_margin * 100, 2)
                })
                
        category_breakdown = []
        for cat, stats in category_stats.items():
            rev = stats["revenue"]
            cogs = stats["cogs"]
            profit = rev - cogs
            margin = (profit / rev * 100) if rev > 0.0 else 0.0
            category_breakdown.append({
                "category": cat,
                "qty_sold": stats["qty_sold"],
                "revenue": round(rev, 2),
                "profit": round(profit, 2),
                "margin_percent": round(margin, 2),
                "items_count": stats["items_count"]
            })
            
        return {
            "category_breakdown": category_breakdown,
            "dead_stock": dead_stock,
            "low_margin_alerts": low_margin
        }
