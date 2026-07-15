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
import asyncio
import concurrent.futures
from app.core.orchestrator.orchestrator import IntelligenceOrchestrator
from app.core.orchestrator.base_engine import EngineContext
from app.services.intelligence.forecast_engine import ForecastEngine
from app.services.intelligence.optimization_engine import OptimizationEngine
from app.services.intelligence.confidence_engine import ConfidenceEngine
from app.services.intelligence.classification_engine import ClassificationEngine
from app.services.intelligence.anomaly_engine import AnomalyEngine
from app.services.intelligence.financial_engine import FinancialEngine
from app.services.intelligence.business_health_engine import BusinessHealthEngine
from app.services.intelligence.action_engine import ActionEngine
from app.services.intelligence.executive_summary_engine import ExecutiveSummaryEngine

logger = logging.getLogger("eve.services.analytics_service")

def run_async_as_sync(coro):
    """Event-loop-safe helper to run async coroutines synchronously."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, coro)
            return future.result()
    else:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)


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
        # Calculate ABC revenue classifications in bulk (A: top 80% revenue, B: next 15%, C: remaining 5%)
        sku_revenue_map = {}
        for item in items:
            prod = item.product
            qty_sold_30 = sales_qty_map.get(prod.id, 0)
            revenue_30 = qty_sold_30 * (prod.selling_price or 40.0)
            sku_revenue_map[prod.sku] = revenue_30

        sorted_skus = sorted(sku_revenue_map.keys(), key=lambda s: sku_revenue_map[s], reverse=True)
        total_rev_30 = sum(sku_revenue_map.values())
        
        abc_classifications = {}
        cumulative_rev = 0.0
        for s in sorted_skus:
            rev = sku_revenue_map[s]
            cumulative_rev += rev
            if total_rev_30 <= 0.001:
                abc_classifications[s] = "C"
            else:
                ratio = cumulative_rev / total_rev_30
                if ratio <= 0.80:
                    abc_classifications[s] = "A"
                elif ratio <= 0.95:
                    abc_classifications[s] = "B"
                else:
                    abc_classifications[s] = "C"

        # Bulk fetch all historical sales records to prevent N+1 queries in the engines
        all_sales_records = db.query(SalesRecord.product_id, SalesRecord.quantity)\
                              .filter(SalesRecord.organization_id == organization_id)\
                              .order_by(SalesRecord.date.asc()).all()
        sales_series_map = {}
        for row in all_sales_records:
            pid = row[0]
            qty = float(row[1]) if row[1] is not None else 0.0
            if pid not in sales_series_map:
                sales_series_map[pid] = []
            sales_series_map[pid].append(qty)

        valid_items = []
        for item in items:
            product = item.product
            if not product or not product.sku or not product.name or item.stock_on_hand is None or item.stock_on_hand < 0:
                continue
            valid_items.append(item)

        # 1b. Run orchestrator in batch for maximum performance and alignment
        async def run_inventory_orchestration_batch():
            orchestrator = IntelligenceOrchestrator()
            orchestrator.register_engine(ForecastEngine())
            orchestrator.register_engine(OptimizationEngine())
            orchestrator.register_engine(ConfidenceEngine())
            orchestrator.register_engine(ClassificationEngine())
            orchestrator.register_engine(AnomalyEngine())
            orchestrator.register_engine(FinancialEngine())
            orchestrator.register_engine(ActionEngine())
            orchestrator.register_engine(ExecutiveSummaryEngine())
            
            tasks = []
            for item in valid_items:
                product = item.product
                vel_info = velocities.get(product.sku, {"avg": 0.0, "std_dev": 0.0})
                sku_sales = sales_series_map.get(product.id, [])
                context = EngineContext(
                    sku=product.sku,
                    stock_on_hand=item.stock_on_hand,
                    lead_time_days=item.lead_time_days,
                    avg_daily_sales=vel_info["avg"],
                    db=db,
                    organization_id=organization_id,
                    parameters={
                        "sales_series_override": sku_sales,
                        "unit_cost_override": product.unit_cost or 20.0,
                        "abc_classifications": abc_classifications
                    }
                )
                tasks.append(orchestrator.run_pipeline(context))
            return await asyncio.gather(*tasks, return_exceptions=True)

        batch_results = run_async_as_sync(run_inventory_orchestration_batch())

        # 2. Iterate products to compile metrics
        for item, pipeline_res in zip(valid_items, batch_results):
            product = item.product
            sku = product.sku
            
            # Fetch velocity parameters
            vel_info = velocities.get(sku, {"avg": 0.0, "std_dev": 0.0})
            avg_daily_sales = vel_info["avg"]
            std_dev = vel_info["std_dev"]
            
            # Extract orchestrator results with failover
            if isinstance(pipeline_res, Exception) or not isinstance(pipeline_res, dict):
                logger.error(f"Orchestrator failed for {sku}, using fallback metrics. Error: {pipeline_res}")
                metrics = calculate_replenishment_metrics(
                    avg_daily_sales=avg_daily_sales,
                    sales_std_dev=std_dev,
                    lead_time_days=item.lead_time_days,
                    stock_on_hand=item.stock_on_hand
                )
                confidence_score = 0.50
                reasoning = ["Calculated using legacy fallback rules."]
                signals = ["Fallback triggered"]
                priority_score = 50
                inventory_class = "HEALTHY"
                abc_class = "B"
                revenue_at_risk = 0.0
                margin_at_risk = 0.0
                working_capital_locked = item.stock_on_hand * (product.unit_cost or 20.0)
                is_dead = detect_dead_stock(item.stock_on_hand, avg_daily_sales)
                
                trace_data = {
                    "current_inventory": item.stock_on_hand,
                    "historical_demand": sales_series_map.get(product.id, []),
                    "forecast_demand": [0.0] * 30,
                    "trend_confidence": 0.5,
                    "lead_time": item.lead_time_days,
                    "safety_stock": 0,
                    "reorder_point": 0,
                    "eoq_adjustment": 0,
                    "revenue_at_risk": 0.0
                }
            else:
                opt_out = pipeline_res.get("engine_outputs", {}).get("optimization_engine", {})
                safety_stock = opt_out.get("data", {}).get("safety_stock", int(avg_daily_sales * item.lead_time_days * 0.5))
                reorder_point = opt_out.get("data", {}).get("reorder_point", int(avg_daily_sales * item.lead_time_days * 1.5))
                reorder_qty = pipeline_res.get("recommended_quantity", 0.0)
                
                trend_confidence = opt_out.get("data", {}).get("trend_confidence", 1.0)
                adjusted_forecast = opt_out.get("data", {}).get("adjusted_forecast", avg_daily_sales)
                
                # Predict stockout days using optimized forecast (or adjusted forecast)
                forecast_out = pipeline_res.get("engine_outputs", {}).get("forecast_engine", {})
                forecast_val = forecast_out.get("data", {}).get("forecast_value", avg_daily_sales)
                if adjusted_forecast <= 0.001:
                    days_until_stockout = 999.0
                else:
                    days_until_stockout = max(0.0, float(item.stock_on_hand) / adjusted_forecast)
                    
                # Stockout risk score calculation matching legacy expectations
                lead_time = item.lead_time_days
                if item.stock_on_hand <= 0 or days_until_stockout <= 0:
                    risk_score = 100.0
                elif days_until_stockout >= lead_time * 2:
                    risk_score = 10.0
                else:
                    ratio = days_until_stockout / lead_time
                    if ratio < 1.0:
                        risk_score = 50.0 + (1.0 - ratio) * 50.0
                    else:
                        risk_score = 50.0 * (2.0 - ratio)
                risk_score = max(0.0, min(100.0, round(risk_score, 1)))

                metrics = {
                    "safety_stock": int(safety_stock),
                    "reorder_point": int(reorder_point),
                    "recommended_reorder_qty": int(reorder_qty),
                    "days_until_stockout": round(days_until_stockout, 1),
                    "stockout_risk_score": risk_score,
                    "size_distribution": opt_out.get("data", {}).get("size_distribution")
                }
                
                trace_data = {
                    "current_inventory": item.stock_on_hand,
                    "historical_demand": sales_series_map.get(product.id, []),
                    "forecast_demand": [float(adjusted_forecast)] * 30,
                    "trend_confidence": float(trend_confidence),
                    "lead_time": item.lead_time_days,
                    "safety_stock": int(safety_stock),
                    "reorder_point": int(reorder_point),
                    "eoq_adjustment": int(reorder_qty),
                    "revenue_at_risk": 0.0 # Will be populated later
                }
                
                confidence_score = pipeline_res.get("confidence_score", 75.0) / 100.0
                reasoning = pipeline_res.get("reasoning", [])
                signals = pipeline_res.get("supporting_signals", [])
                
                if trend_confidence < 1.0:
                    pct = int(trend_confidence * 100)
                    msg = f"Viral Trend Detected (Low Confidence: {pct}%). Reorder scaled down to prevent bulk over-ordering until trend confirms."
                    if msg not in reasoning:
                        reasoning.insert(0, msg)
                    signals.append(f"Adjusted forecast: {adjusted_forecast:.1f} (Raw: {forecast_val:.1f})")
                
                if not product.unit_cost or product.unit_cost <= 0:
                    msg = "Missing Unit Cost: Applied default $20.00 cost assumption. Financial risks may be inaccurate."
                    if msg not in reasoning:
                        reasoning.append(msg)
                    signals.append("Missing COGS Data")
                
                # Pull Phase 2 Prioritization metrics
                priority_score = pipeline_res.get("priority_score", 50)
                inventory_class = pipeline_res.get("inventory_class", "HEALTHY")
                abc_class = pipeline_res.get("abc_class", "B")
                revenue_at_risk = pipeline_res.get("revenue_at_risk", 0.0)
                margin_at_risk = pipeline_res.get("margin_at_risk", 0.0)
                working_capital_locked = pipeline_res.get("working_capital_locked", 0.0)
                is_dead = (inventory_class == "DEAD_STOCK")
                
                trace_data["revenue_at_risk"] = revenue_at_risk
            
            # Write metrics back to database for persistence
            item.avg_daily_sales = avg_daily_sales
            item.safety_stock = metrics["safety_stock"]
            item.reorder_point = metrics["reorder_point"]
            
            # Get cached sales quantity
            units_sold = sales_qty_map.get(product.id, 0)
                           
            str_rate = calculate_sell_through_rate(units_sold, item.stock_on_hand)
            
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
                "sell_through_rate": str_rate,
                "confidence_score": confidence_score,
                
                # Prioritization fields
                "priority_score": priority_score,
                "inventory_class": inventory_class,
                "abc_class": abc_class,
                "revenue_at_risk": revenue_at_risk,
                "margin_at_risk": margin_at_risk,
                "working_capital_locked": working_capital_locked,
                
                "trace_data": trace_data,
                
                "explainability": {
                    "method": "EVE Multi-Engine Orchestrator (Forecast + Optimization + Confidence + Prioritization)",
                    "factors": reasoning + signals
                },
                "provenance": {
                    "source": "AnalyticsService.get_inventory_analysis",
                    "calculated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
            })

        # --- Variant Aggregation Logic ---
        aggregated_analyses = {}
        for analysis in sku_analyses:
            parent_id = next((item.product.parent_product_id for item in items if item.product.sku == analysis["sku"]), None)
            group_key = parent_id if parent_id else analysis["sku"]
            
            if group_key not in aggregated_analyses:
                aggregated_analyses[group_key] = analysis.copy()
                if parent_id:
                    aggregated_analyses[group_key]["name"] = f"{analysis['name'].split(' - ')[0]}"
                    aggregated_analyses[group_key]["sku"] = parent_id
            else:
                existing = aggregated_analyses[group_key]
                existing["stock_on_hand"] += analysis["stock_on_hand"]
                existing["safety_stock"] += analysis["safety_stock"]
                existing["reorder_point"] += analysis["reorder_point"]
                existing["reorder_quantity"] += analysis["reorder_quantity"]
                existing["avg_daily_sales"] += analysis["avg_daily_sales"]
                
                if analysis["stockout_risk_score"] > existing["stockout_risk_score"]:
                    existing["stockout_risk_score"] = analysis["stockout_risk_score"]
                    existing["days_until_stockout"] = analysis["days_until_stockout"]
                
                # Aggregate trace_data
                if "trace_data" in existing and "trace_data" in analysis:
                    existing_trace = existing["trace_data"]
                    new_trace = analysis["trace_data"]
                    existing_trace["current_inventory"] += new_trace["current_inventory"]
                    existing_trace["safety_stock"] += new_trace["safety_stock"]
                    existing_trace["reorder_point"] += new_trace["reorder_point"]
                    existing_trace["eoq_adjustment"] += new_trace["eoq_adjustment"]
                    existing_trace["revenue_at_risk"] += new_trace["revenue_at_risk"]
                    
                    # Element-wise addition for historical demand arrays
                    hist1 = existing_trace["historical_demand"]
                    hist2 = new_trace["historical_demand"]
                    max_len_hist = max(len(hist1), len(hist2))
                    summed_hist = []
                    for i in range(max_len_hist):
                        val1 = hist1[i] if i < len(hist1) else 0.0
                        val2 = hist2[i] if i < len(hist2) else 0.0
                        summed_hist.append(val1 + val2)
                    existing_trace["historical_demand"] = summed_hist
                    
                    # Element-wise addition for forecast demand arrays
                    fore1 = existing_trace["forecast_demand"]
                    fore2 = new_trace["forecast_demand"]
                    max_len_fore = max(len(fore1), len(fore2))
                    summed_fore = []
                    for i in range(max_len_fore):
                        val1 = fore1[i] if i < len(fore1) else 0.0
                        val2 = fore2[i] if i < len(fore2) else 0.0
                        summed_fore.append(val1 + val2)
                    existing_trace["forecast_demand"] = summed_fore
                    
                    # Keep minimum trend confidence as safe bound
                    existing_trace["trend_confidence"] = min(existing_trace["trend_confidence"], new_trace["trend_confidence"])
                    # Lead time should ideally be the same, max is safer
                    existing_trace["lead_time"] = max(existing_trace["lead_time"], new_trace["lead_time"])
                    
                if analysis["priority_score"] > existing["priority_score"]:
                    existing["priority_score"] = analysis["priority_score"]
                
                existing["revenue_at_risk"] += analysis["revenue_at_risk"]
                existing["margin_at_risk"] += analysis["margin_at_risk"]
                existing["working_capital_locked"] += analysis["working_capital_locked"]
                
                if analysis["is_dead_stock"] and not existing["is_dead_stock"]:
                    existing["is_dead_stock"] = True
                    
        sku_analyses = list(aggregated_analyses.values())
        # --------------------------------

        db.commit() # Commit updated points

        avg_risk = total_risk_score / len(items) if items else 0.0
        
        # Compile catalog aggregates for BusinessHealthEngine
        successful_results = [res for res in batch_results if isinstance(res, dict) and not isinstance(res, Exception)]
        healthy_skus = sum(1 for res in successful_results if res.get("inventory_class") in ["HEALTHY", "SLOW_MOVING"])
        dead_capital = sum(res.get("working_capital_locked", 0.0) for res in successful_results if res.get("inventory_class") == "DEAD_STOCK")
        total_capital = sum(res.get("working_capital_locked", 0.0) for res in successful_results)
        anomalous_skus = sum(1 for res in successful_results if res.get("anomalies"))
        
        business_health_score = None
        business_health_grade = "N/A"
        if len(items) > 0:
            business_health_score = 80
            business_health_grade = "B"
            try:
                health_eng = BusinessHealthEngine()
                health_context = EngineContext(
                    sku="ORGANIZATION_HEALTH",
                    stock_on_hand=0,
                    lead_time_days=0,
                    avg_daily_sales=0.0,
                    parameters={
                        "catalog_total_skus": len(items),
                        "catalog_healthy_skus": healthy_skus,
                        "catalog_avg_stockout_risk": avg_risk,
                        "catalog_dead_capital": dead_capital,
                        "catalog_total_capital": total_capital,
                        "catalog_anomalous_skus": anomalous_skus
                    }
                )
                health_output = run_async_as_sync(health_eng.execute(health_context))
                if health_output.success:
                    business_health_score = health_output.data.get("health_score", 80)
                    business_health_grade = health_output.data.get("health_grade", "B")
            except Exception as e:
                logger.error(f"Failed to calculate catalog health score: {e}")

        # Compile Top Risks (Top 5 ranked by priority descending, then impact descending)
        all_risks = [res["risk"] for res in successful_results if res.get("risk")]
        top_risks = sorted(all_risks, key=lambda r: (r["priority"], r["impact"]), reverse=True)[:5]
        
        # Compile Top Opportunities (Top 5 ranked by dollar value descending)
        all_opportunities = []
        for res in successful_results:
            all_opportunities.extend(res.get("opportunities", []))
        top_opportunities = sorted(all_opportunities, key=lambda o: o.get("value", 0.0), reverse=True)[:5]
        
        # Compile Top Actions (Top 5 recommended actions derived from highest priority items)
        sorted_results = sorted(successful_results, key=lambda r: r.get("priority_score", 50), reverse=True)
        top_actions = []
        for res in sorted_results:
            for action in res.get("actions", []):
                if action not in top_actions and "Monitor sales velocity" not in action:
                    top_actions.append(action)
                    if len(top_actions) >= 5:
                        break
            if len(top_actions) >= 5:
                break
        if not top_actions:
            top_actions = ["No urgent actions needed. Maintain current strategy."]

        return {
            "organization_id": organization_id,
            "total_skus": len(items),
            "out_of_stock_skus": out_of_stock_count,
            "low_stock_skus": low_stock_count,
            "dead_stock_skus": dead_stock_count,
            "average_risk_score": round(avg_risk, 1),
            "estimated_reorder_cost": round(total_reorder_cost, 2),
            
            # Prioritization outputs
            "business_health_score": business_health_score,
            "business_health_grade": business_health_grade,
            "top_risks": top_risks,
            "top_opportunities": top_opportunities,
            "top_actions": top_actions,
            
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
        
        # Bulk fetch all historical sales records to prevent N+1 queries in the engines
        all_sales_records = db.query(SalesRecord.product_id, SalesRecord.quantity)\
                              .filter(SalesRecord.organization_id == organization_id)\
                              .order_by(SalesRecord.date.asc()).all()
        sales_series_map = {}
        for row in all_sales_records:
            pid = row[0]
            qty = float(row[1]) if row[1] is not None else 0.0
            if pid not in sales_series_map:
                sales_series_map[pid] = []
            sales_series_map[pid].append(qty)
            
        recommendations = []
        total_profit_impact = 0.0
        total_revenue_impact = 0.0
        current_margin_sum = 0.0
        recommended_margin_sum = 0.0
        
        # 1b. Run orchestrator in batch for pricing calculations
        async def run_pricing_orchestration_batch():
            orchestrator = IntelligenceOrchestrator()
            orchestrator.register_engine(ForecastEngine())
            orchestrator.register_engine(OptimizationEngine())
            orchestrator.register_engine(ConfidenceEngine())
            
            tasks = []
            for item in items:
                sku_sales = sales_series_map.get(item.product_id, [])
                context = EngineContext(
                    sku=item.product.sku,
                    stock_on_hand=item.stock_on_hand,
                    lead_time_days=item.lead_time_days,
                    avg_daily_sales=item.avg_daily_sales or 0.0,
                    db=db,
                    organization_id=organization_id,
                    parameters={
                        "sales_series_override": sku_sales,
                        "unit_cost_override": item.product.unit_cost or 20.0
                    }
                )
                tasks.append(orchestrator.run_pipeline(context))
            return await asyncio.gather(*tasks, return_exceptions=True)

        batch_results = run_async_as_sync(run_pricing_orchestration_batch())
        
        for item, pipeline_res in zip(items, batch_results):
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
            
            if isinstance(pipeline_res, Exception) or not isinstance(pipeline_res, dict):
                stockout_risk_score = 0.0
            else:
                forecast_out = pipeline_res.get("engine_outputs", {}).get("forecast_engine", {})
                forecast_val = forecast_out.get("data", {}).get("forecast_value", item.avg_daily_sales or 0.0)
                if forecast_val <= 0.001:
                    days_until_stockout = 999.0
                else:
                    days_until_stockout = max(0.0, float(item.stock_on_hand) / forecast_val)
                    
                lead_time = item.lead_time_days
                if item.stock_on_hand <= 0 or days_until_stockout <= 0:
                    stockout_risk_score = 100.0
                elif days_until_stockout >= lead_time * 2:
                    stockout_risk_score = 10.0
                else:
                    ratio = days_until_stockout / lead_time
                    if ratio < 1.0:
                        stockout_risk_score = 50.0 + (1.0 - ratio) * 50.0
                    else:
                        stockout_risk_score = 50.0 * (2.0 - ratio)
            
            price_change_pct = 0.0
            reason = "Price is optimal."
            
            if item.stock_on_hand <= 0:
                price_change_pct = 0.0
                reason = "Out of stock. Hold price."
            elif stockout_risk_score >= 70.0:
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
                        f"Stockout risk factor: {stockout_risk_score:.1f}%"
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
