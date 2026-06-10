# ==============================================================================
# PURPOSE: Business logic service layer for Fashion Intelligence analytics.
# DATA FLOW: Reads Product, InventoryItem, and SalesRecord databases -> processes math ->
#            returns structured dictionaries corresponding to dashboards and report templates.
# EXTENSION POINTS: Add cache mechanisms, support machine learning regression forecasts.
# ARCHITECTURAL DECISION:
# - Decouples SQL queries and statistical calculations from API controllers.
# - Promotes unit testability by allowing database injection.
# ==============================================================================

import logging
import datetime
from typing import Dict, Any, List
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.dependency_container import container

from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.models.supplier import Supplier
from app.fashion.sell_through import calculate_sell_through_rate
from app.fashion.dead_stock import detect_dead_stock
from app.fashion.inventory_turnover import calculate_inventory_turnover
from app.fashion.gmroi import calculate_gmroi
from app.fashion.demand_forecast import calculate_replenishment_metrics
from app.fashion.stockout_prediction import predict_stockout
from app.fashion.reorder_engine import calculate_reorder_quantity
from app.fashion.margin_analysis import calculate_margin
from app.fashion.profit_impact import estimate_profit_impact

logger = logging.getLogger("eve.services.analytics_service")


class AnalyticsService:
    """
    Service layer containing core fashion intelligence retrieval logic.
    """

    @classmethod
    def calculate_sales_velocities(cls, db: Session, organization_id: int) -> Dict[str, Dict[str, float]]:
        """
        Calculates average daily sales velocity and standard deviation for all active products.
        """
        # Fetch sales aggregates grouped by SKU
        sales_data = db.query(
            Product.sku,
            SalesRecord.date,
            func.sum(SalesRecord.quantity).label("daily_qty")
        ).join(SalesRecord, Product.id == SalesRecord.product_id)\
         .filter(Product.organization_id == organization_id)\
         .group_by(Product.sku, SalesRecord.date).all()

        # Group dates and quantities per SKU
        sku_series = {}
        for row in sales_data:
            sku = row[0]
            qty = row[2]
            if sku not in sku_series:
                sku_series[sku] = []
            sku_series[sku].append(qty)

        # Compute average and standard deviation
        import math
        velocities = {}
        for sku, series in sku_series.items():
            n = len(series)
            if n == 0:
                velocities[sku] = {"avg": 0.0, "std_dev": 0.0}
                continue
                
            avg = sum(series) / n
            
            # Standard deviation calculation
            variance = sum((x - avg) ** 2 for x in series) / n
            std_dev = math.sqrt(variance)
            
            velocities[sku] = {"avg": round(avg, 3), "std_dev": round(std_dev, 3)}

        return velocities

    @classmethod
    def get_inventory_analysis(cls, db: Session, organization_id: int) -> Dict[str, Any]:
        """
        Runs the full inventory health analysis for an organization.
        """
        logger.info(f"Running inventory health analysis for Org: {organization_id}...")
        
        # 1. Fetch products and current inventory
        items = db.query(InventoryItem).options(joinedload(InventoryItem.product))\
                  .filter(InventoryItem.organization_id == organization_id).all()
                  
        velocities = cls.calculate_sales_velocities(db, organization_id)
        
        sku_analyses = []
        out_of_stock_count = 0
        low_stock_count = 0
        dead_stock_count = 0
        total_risk_score = 0.0
        total_reorder_cost = 0.0
        
        # Fetch sales quantities for Sell Through Calculations (past 30 days) in bulk
        thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)
        thirty_day_sales = db.query(SalesRecord.product_id, func.sum(SalesRecord.quantity))\
                             .filter(SalesRecord.organization_id == organization_id)\
                             .filter(SalesRecord.date >= thirty_days_ago)\
                             .group_by(SalesRecord.product_id).all()
        sales_qty_map = {row[0]: int(row[1]) for row in thirty_day_sales if row[1] is not None}
        
        # 2. Iterate products to calculate metrics
        for item in items:
            product = item.product
            sku = product.sku
            
            # Fetch velocity parameters
            vel_info = velocities.get(sku, {"avg": 0.0, "std_dev": 0.0})
            avg_daily_sales = vel_info["avg"]
            std_dev = vel_info["std_dev"]
            
            # Calculate replenishment numbers
            metrics = calculate_replenishment_metrics(
                avg_daily_sales=avg_daily_sales,
                sales_std_dev=std_dev,
                lead_time_days=item.lead_time_days,
                stock_on_hand=item.stock_on_hand
            )
            
            # Write metrics back to database for persistence
            item.avg_daily_sales = avg_daily_sales
            item.safety_stock = metrics["safety_stock"]
            item.reorder_point = metrics["reorder_point"]
            
            # Get cached sales quantity
            units_sold = sales_qty_map.get(product.id, 0)
                           
            str_rate = calculate_sell_through_rate(units_sold, item.stock_on_hand)
            is_dead = detect_dead_stock(item.stock_on_hand, avg_daily_sales)
            
            # Count aggregations
            if item.stock_on_hand <= 0:
                out_of_stock_count += 1
            elif item.stock_on_hand < metrics["reorder_point"]:
                low_stock_count += 1
                
            if is_dead:
                dead_stock_count += 1
                
            total_risk_score += metrics["stockout_risk_score"]
            
            # Reorder cost = unit_cost * recommended_reorder_qty if below ROP
            reorder_qty = 0
            if item.stock_on_hand < metrics["reorder_point"]:
                reorder_qty = metrics["recommended_reorder_qty"]
                total_reorder_cost += (product.unit_cost * reorder_qty)
                
            sku_analyses.append({
                "sku": sku,
                "name": product.name,
                "category": product.category,
                "stock_on_hand": item.stock_on_hand,
                "safety_stock": metrics["safety_stock"],
                "reorder_point": metrics["reorder_point"],
                "reorder_quantity": reorder_qty,
                "lead_time_days": item.lead_time_days,
                "avg_daily_sales": avg_daily_sales,
                "days_until_stockout": metrics["days_until_stockout"],
                "stockout_risk_score": metrics["stockout_risk_score"],
                "is_dead_stock": is_dead,
                "sell_through_rate": str_rate
            })

        db.commit() # Commit updated points

        avg_risk = total_risk_score / len(items) if items else 0.0
        
        return {
            "organization_id": organization_id,
            "total_skus": len(items),
            "out_of_stock_skus": out_of_stock_count,
            "low_stock_skus": low_stock_count,
            "dead_stock_skus": dead_stock_count,
            "average_risk_score": round(avg_risk, 1),
            "estimated_reorder_cost": round(total_reorder_cost, 2),
            "items_at_risk": sku_analyses
        }

    @classmethod
    def get_pricing_analysis(cls, db: Session, organization_id: int) -> Dict[str, Any]:
        """
        Runs pricing margin analysis and dynamic price suggestions.
        """
        logger.info(f"Running pricing adjustments analysis for Org: {organization_id}...")
        
        items = db.query(InventoryItem).options(joinedload(InventoryItem.product))\
                  .filter(InventoryItem.organization_id == organization_id).all()
                  
        # Bulk fetch average unit prices
        avg_prices = db.query(SalesRecord.product_id, func.avg(SalesRecord.unit_price))\
                       .filter(SalesRecord.organization_id == organization_id)\
                       .group_by(SalesRecord.product_id).all()
        avg_price_map = {row[0]: float(row[1]) for row in avg_prices if row[1] is not None}

        # Bulk fetch sales quantities for past 30 days
        thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)
        thirty_day_sales = db.query(SalesRecord.product_id, func.sum(SalesRecord.quantity))\
                             .filter(SalesRecord.organization_id == organization_id)\
                             .filter(SalesRecord.date >= thirty_days_ago)\
                             .group_by(SalesRecord.product_id).all()
        sales_qty_map = {row[0]: int(row[1]) for row in thirty_day_sales if row[1] is not None}
        
        recommendations = []
        total_profit_impact = 0.0
        total_revenue_impact = 0.0
        current_margin_sum = 0.0
        recommended_margin_sum = 0.0
        
        for item in items:
            product = item.product
            
            # Use cached average price
            current_price = avg_price_map.get(product.id, 50.0)
            
            # Define margin: (price - cost) / price
            unit_cost = product.unit_cost
            if current_price > 0:
                current_margin = (current_price - unit_cost) / current_price
            else:
                current_margin = 0.0
                
            # Compute elasticity score (mock standard: higher for luxury categories, lower for basics)
            elasticity = 1.2 # Basics
            if product.category.lower() in ["outerwear", "dresses"]:
                elasticity = 1.8 # Higher price sensitivity
                
            # suggestion engine logic:
            # - If item has high stockout risk (low stock), increase price by 5-15% (price skimming)
            # - If item is dead stock (slow velocity), reduce price by 15-30% (markdown clearance)
            # - Otherwise suggest a minor margin-optimizing change (e.g. target 60% margin)
            
            reorder_metrics = calculate_replenishment_metrics(
                avg_daily_sales=item.avg_daily_sales,
                sales_std_dev=0.0,
                lead_time_days=item.lead_time_days,
                stock_on_hand=item.stock_on_hand
            )
            
            price_change_pct = 0.0
            reason = "Price is optimal."
            
            if item.stock_on_hand <= 0:
                price_change_pct = 0.0
                reason = "Out of stock. Hold price."
            elif reorder_metrics["stockout_risk_score"] >= 70.0:
                price_change_pct = 0.10 # 10% increase to slow runout rate
                reason = "High stockout risk. Increasing price to slow velocity and capture margin."
            elif detect_dead_stock(item.stock_on_hand, item.avg_daily_sales):
                price_change_pct = -0.20 # 20% markdown clearance
                reason = "Dead stock detected. Mark down 20% to clear warehouse space."
            else:
                # Target standard gross margin (e.g. 65%)
                target_margin = 0.65
                target_price = unit_cost / (1.0 - target_margin) if unit_cost > 0 else current_price
                price_change_pct = (target_price - current_price) / current_price
                # Cap suggestions between -5% and +15%
                price_change_pct = max(-0.05, min(0.15, price_change_pct))
                reason = "Optimizing price to reach target 65% gross margin."

            recommended_price = round(current_price * (1.0 + price_change_pct), 2)
            
            # Re-calculate suggested margin
            if recommended_price > 0:
                rec_margin = (recommended_price - unit_cost) / recommended_price
            else:
                rec_margin = 0.0

            # Get cached sales quantity
            units_sold = sales_qty_map.get(product.id, 0)
            
            # Quantity change = - Price Change % * Elasticity Coefficient
            qty_change_pct = -price_change_pct * elasticity
            projected_qty_sold = max(0.0, units_sold * (1.0 + qty_change_pct))
            
            # Revenue impact = (Rec Price * Rec Qty) - (Curr Price * Curr Qty)
            curr_rev = current_price * units_sold
            proj_rev = recommended_price * projected_qty_sold
            rev_impact = proj_rev - curr_rev
            
            # Profit impact = (Margin Dollars * Qty) delta
            curr_prof = (current_price - unit_cost) * units_sold
            proj_prof = (recommended_price - unit_cost) * projected_qty_sold
            prof_impact = proj_prof - curr_prof
            
            total_profit_impact += prof_impact
            total_revenue_impact += rev_impact
            current_margin_sum += current_margin
            recommended_margin_sum += rec_margin
            
            recommendations.append({
                "sku": product.sku,
                "name": product.name,
                "unit_cost": round(unit_cost, 2),
                "current_price": round(current_price, 2),
                "recommended_price": round(recommended_price, 2),
                "current_margin": round(current_margin * 100.0, 2),
                "recommended_margin": round(rec_margin * 100.0, 2),
                "price_change_percentage": round(price_change_pct * 100.0, 2),
                "elasticity_score": elasticity,
                "projected_volume_change_pct": round(qty_change_pct * 100.0, 2),
                "projected_revenue_impact": round(rev_impact, 2),
                "projected_profit_impact": round(prof_impact, 2),
                "recommendation_reason": reason
            })

        n_items = len(items)
        avg_curr_m = (current_margin_sum / n_items) * 100.0 if n_items else 0.0
        avg_rec_m = (recommended_margin_sum / n_items) * 100.0 if n_items else 0.0

        return {
            "organization_id": organization_id,
            "average_current_margin": round(avg_curr_m, 2),
            "average_recommended_margin": round(avg_rec_m, 2),
            "estimated_revenue_impact": round(total_revenue_impact, 2),
            "estimated_profit_impact": round(total_profit_impact, 2),
            "recommendations": recommendations
        }

    @classmethod
    def get_dashboard_metrics(cls, db: Session, organization_id: int) -> Dict[str, Any]:
        """
        Aggregates all key metrics for the Phase 3 Dashboard API.
        """
        logger.info(f"Generating dashboard metrics for Org: {organization_id}...")
        
        items = db.query(InventoryItem).options(joinedload(InventoryItem.product))\
                  .filter(InventoryItem.organization_id == organization_id).all()
                  
        velocities = cls.calculate_sales_velocities(db, organization_id)
        
        # Bulk fetch average unit prices
        avg_prices = db.query(SalesRecord.product_id, func.avg(SalesRecord.unit_price))\
                       .filter(SalesRecord.organization_id == organization_id)\
                       .group_by(SalesRecord.product_id).all()
        avg_price_map = {row[0]: float(row[1]) for row in avg_prices if row[1] is not None}

        # Bulk fetch sales quantities for past 30 days
        thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)
        thirty_day_sales = db.query(SalesRecord.product_id, func.sum(SalesRecord.quantity))\
                             .filter(SalesRecord.organization_id == organization_id)\
                             .filter(SalesRecord.date >= thirty_days_ago)\
                             .group_by(SalesRecord.product_id).all()
        sales_qty_map = {row[0]: int(row[1]) for row in thirty_day_sales if row[1] is not None}

        dead_stock_items = []
        stockout_predictions = []
        reorder_recommendations = []
        pricing_recommendations = []
        
        total_risk_score = 0.0
        total_profit_impact = 0.0
        
        for item in items:
            product = item.product
            sku = product.sku
            
            vel_info = velocities.get(sku, {"avg": 0.0, "std_dev": 0.0})
            avg_daily_sales = vel_info["avg"]
            
            # Dead Stock
            if detect_dead_stock(item.stock_on_hand, avg_daily_sales, threshold_days=30):
                dead_stock_items.append({"sku": sku, "name": product.name, "stock_on_hand": item.stock_on_hand})
                
            # Stockout Prediction
            stockout_data = predict_stockout(sku, item.stock_on_hand, avg_daily_sales)
            stockout_predictions.append(stockout_data)
            
            # Reorder quantity
            reorder_metrics = calculate_replenishment_metrics(
                avg_daily_sales=avg_daily_sales,
                sales_std_dev=vel_info["std_dev"],
                lead_time_days=item.lead_time_days,
                stock_on_hand=item.stock_on_hand
            )
            # Use new engine for ROP qty
            reorder_qty = calculate_reorder_quantity(
                sku, avg_daily_sales, item.lead_time_days, reorder_metrics["safety_stock"]
            )
            if item.stock_on_hand < reorder_metrics["reorder_point"]:
                reorder_recommendations.append(reorder_qty)
                
            total_risk_score += reorder_metrics["stockout_risk_score"]
            
            # Use cached current price
            current_price = avg_price_map.get(product.id, 50.0)
            
            margin_data = calculate_margin(current_price, product.unit_cost)
            
            # Calculate pricing recommendations (mock suggestion rules)
            recommended_price = current_price
            reason = "Price is optimal."
            if item.stock_on_hand <= 0:
                pass
            elif reorder_metrics["stockout_risk_score"] >= 70.0:
                recommended_price = current_price * 1.10
                reason = "High stockout risk. Increasing price to slow velocity."
            elif detect_dead_stock(item.stock_on_hand, avg_daily_sales, threshold_days=30):
                recommended_price = current_price * 0.80
                reason = "Dead stock detected. Mark down 20% to clear."
            else:
                target_margin = 0.65
                target_price = product.unit_cost / (1.0 - target_margin) if product.unit_cost > 0 else current_price
                recommended_price = target_price
                reason = "Optimizing price to reach target 65% gross margin."
                
            pricing_recommendations.append({
                "sku": sku,
                "current_price": round(current_price, 2),
                "recommended_price": round(recommended_price, 2),
                "current_margin_percent": margin_data["margin_percent"],
                "reason": reason
            })
            
            # Get cached sales quantity
            units_sold = sales_qty_map.get(product.id, 0)
            
            impact = estimate_profit_impact(
                current_price=current_price,
                recommended_price=recommended_price,
                unit_cost=product.unit_cost,
                projected_sales_volume=units_sold
            )
            total_profit_impact += impact["estimated_profit_impact"]

        avg_risk = total_risk_score / len(items) if items else 0.0

        return {
            "inventory_risk_score": round(avg_risk, 1),
            "dead_stock_items": dead_stock_items,
            "stockout_predictions": stockout_predictions,
            "reorder_recommendations": reorder_recommendations,
            "pricing_recommendations": pricing_recommendations,
            "estimated_profit_impact": round(total_profit_impact, 2)
        }


# Register AnalyticsService inside Container
container.register_singleton("analytics_service", AnalyticsService)
