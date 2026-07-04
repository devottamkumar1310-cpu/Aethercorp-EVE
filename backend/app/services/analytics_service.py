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
from typing import Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.dependency_container import container

from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.fashion.sell_through import calculate_sell_through_rate
from app.fashion.dead_stock import detect_dead_stock
from app.fashion.demand_forecast import calculate_replenishment_metrics

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
        import uuid
        if isinstance(organization_id, str):
            organization_id = uuid.UUID(organization_id)
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
        import uuid
        if isinstance(organization_id, str):
            organization_id = uuid.UUID(organization_id)
        from app.services.data_quality_service import DataQualityService
        DataQualityService.check_and_block_if_corrupted(db, organization_id)

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
                
            confidence = 0.95 if item.lead_time_days <= 14 else 0.88
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
                "sell_through_rate": str_rate,
                "confidence_score": confidence,
                "explainability": {
                    "method": "Safety Stock & ROP calculations",
                    "factors": [
                        f"Lead time days: {item.lead_time_days}",
                        f"Daily sales velocity: {avg_daily_sales:.3f} units/day",
                        f"Safety stock: {metrics['safety_stock']} units",
                        f"Stockout risk score: {metrics['stockout_risk_score']:.1f}%"
                    ]
                },
                "provenance": {
                    "source": "AnalyticsService.get_inventory_analysis",
                    "calculated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
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
        import uuid
        if isinstance(organization_id, str):
            organization_id = uuid.UUID(organization_id)
        from app.services.data_quality_service import DataQualityService
        DataQualityService.check_and_block_if_corrupted(db, organization_id)

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
            projected_qty_sold = min(float(item.stock_on_hand), max(0.0, units_sold * (1.0 + qty_change_pct)))
            
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
            
            confidence = 0.88 if product.category.lower() in ["outerwear", "dresses"] else 0.92
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
                "recommendation_reason": reason,
                "confidence_score": confidence,
                "explainability": {
                    "method": "Price Elasticity & Stockout Risk analysis",
                    "factors": [
                        f"Price elasticity: {elasticity}",
                        f"Projected volume change: {qty_change_pct * 100.0:.1f}%",
                        f"Unit cost: ${unit_cost:.2f}",
                        f"Stockout risk factor: {reorder_metrics['stockout_risk_score']:.1f}%"
                    ]
                },
                "provenance": {
                    "source": "AnalyticsService.get_pricing_analysis",
                    "calculated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
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
    def calculate_revenue_forecast(cls, db: Session, organization_id: Any) -> float:
        """
        Projects next 30 days of sales revenue using Exponential Smoothing run-rate.
        """
        from app.models.inventory import SalesRecord
        from app.services.forecasting_engine import ForecastingEngine
        
        thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)
        daily_revs = db.query(
            SalesRecord.date,
            func.sum(SalesRecord.revenue).label("daily_rev")
        ).filter(SalesRecord.organization_id == organization_id)\
         .filter(SalesRecord.date >= thirty_days_ago)\
         .group_by(SalesRecord.date)\
         .order_by(SalesRecord.date).all()
         
        revs = [float(row[1]) for row in daily_revs if row[1] is not None]
        forecast_res = ForecastingEngine.forecast_next_30_days(revs, method="exponential_smoothing")
        return forecast_res["forecasted_quantity"]

    @classmethod
    def get_dashboard_metrics(cls, db: Session, organization_id: int) -> Dict[str, Any]:
        """
        Aggregates all key metrics for the Phase 3 Dashboard API.
        Enforces a Single Source of Truth by calling inventory and pricing analysis layers.
        """
        import uuid
        if isinstance(organization_id, str):
            organization_id = uuid.UUID(organization_id)
        from app.services.data_quality_service import DataQualityService
        DataQualityService.check_and_block_if_corrupted(db, organization_id)

        logger.info(f"Generating aligned dashboard metrics for Org: {organization_id}...")

        inventory_analysis = cls.get_inventory_analysis(db, organization_id)
        pricing_analysis = cls.get_pricing_analysis(db, organization_id)

        dead_stock_items = []
        stockout_predictions = []
        reorder_recommendations = []
        pricing_recommendations = []

        for item in inventory_analysis["items_at_risk"]:
            if item["is_dead_stock"]:
                dead_stock_items.append({
                    "sku": item["sku"],
                    "name": item["name"],
                    "stock_on_hand": item["stock_on_hand"]
                })

            stockout_predictions.append({
                "sku": item["sku"],
                "days_until_stockout": item["days_until_stockout"],
                "confidence_score": item["confidence_score"],
                "explainability": item["explainability"],
                "provenance": item["provenance"]
            })

            if item["reorder_quantity"] > 0:
                reorder_recommendations.append({
                    "sku": item["sku"],
                    "recommended_reorder": item["reorder_quantity"],
                    "confidence_score": item["confidence_score"],
                    "explainability": item["explainability"],
                    "provenance": item["provenance"]
                })

        for rec in pricing_analysis["recommendations"]:
            pricing_recommendations.append({
                "sku": rec["sku"],
                "current_price": rec["current_price"],
                "recommended_price": rec["recommended_price"],
                "current_margin_percent": rec["current_margin"],
                "reason": rec["recommendation_reason"],
                "confidence_score": rec["confidence_score"],
                "explainability": rec["explainability"],
                "provenance": rec["provenance"]
            })

        # Dynamic Capital reserve & risk metrics calculations
        from app.services.simulation_engine import SimulationEngine
        cf = SimulationEngine.simulate_cash_flow_forecast(30, organization_id, db)
        
        inventory_capital_requirements = cf.get("required_working_capital", 0.0)
        required_capital = cf.get("required_capital", 0.0)
        available_capital = cf.get("available_capital", 50000.0)
        capital_gap = cf.get("capital_gap", 0.0)
        
        # Calculate revenue forecast
        revenue_forecast = cls.calculate_revenue_forecast(db, organization_id)
        
        # Calculate risk engine scores
        stockout_risk = inventory_analysis["average_risk_score"]
        
        total_skus = inventory_analysis["total_skus"]
        dead_skus = inventory_analysis["dead_stock_skus"]
        inventory_risk_val = (dead_skus / total_skus * 100.0) if total_skus > 0 else 0.0
        
        cash_risk_val = (capital_gap / required_capital * 100.0) if required_capital > 0 else 0.0
        
        total_pricing_recs = len(pricing_analysis["recommendations"])
        neg_margin_count = sum(1 for rec in pricing_analysis["recommendations"] if rec.get("current_margin_percent", 0.0) < 0.0)
        margin_risk_val = (neg_margin_count / total_pricing_recs * 100.0) if total_pricing_recs > 0 else 0.0
        
        def _get_risk_label(val: float) -> str:
            """
            Threshold classification logic:
            - Low: < 25.0%
            - Medium: 25.0% - 49.9%
            - High: 50.0% - 74.9%
            - Critical: >= 75.0%
            """
            if val >= 75.0:
                return "Critical"
            elif val >= 50.0:
                return "High"
            elif val >= 25.0:
                return "Medium"
            else:
                return "Low"

        risk_forecast = {
            "stockout_risk": f"{stockout_risk:.1f}%",
            "stockout_risk_label": _get_risk_label(stockout_risk),
            "cash_risk": f"{cash_risk_val:.1f}%",
            "cash_risk_label": _get_risk_label(cash_risk_val),
            "inventory_risk": f"{inventory_risk_val:.1f}%",
            "inventory_risk_label": _get_risk_label(inventory_risk_val),
            "margin_risk": f"{margin_risk_val:.1f}%",
            "margin_risk_label": _get_risk_label(margin_risk_val)
        }

        return {
            "inventory_risk_score": inventory_analysis["average_risk_score"],
            "dead_stock_items": dead_stock_items,
            "stockout_predictions": stockout_predictions,
            "reorder_recommendations": reorder_recommendations,
            "pricing_recommendations": pricing_recommendations,
            "estimated_profit_impact": pricing_analysis["estimated_profit_impact"],
            "inventory_capital_requirements": inventory_capital_requirements,
            "revenue_forecast": revenue_forecast,
            "risk_forecast": risk_forecast,
            "required_capital": required_capital,
            "available_capital": available_capital,
            "capital_gap": capital_gap
        }


# Register AnalyticsService inside Container
container.register_singleton("analytics_service", AnalyticsService)
