from typing import Dict, Any
from sqlalchemy.orm import Session
from app.services.analytics_service import AnalyticsService
from app.services.confidence_engine import ConfidenceEngine

class SimulationEngine:
    @staticmethod
    def simulate_price_change(percentage: float, org_id: int, db: Session) -> Dict[str, Any]:
        metrics = AnalyticsService.get_dashboard_metrics(db, org_id)
        
        # Calculate impact of price change
        # Simplified deterministic model: 
        # A price increase of X% leads to volume drop of (X * 1.2)%
        # A price decrease of X% leads to volume increase of (X * 1.5)%
        
        elasticity = 1.2 if percentage > 0 else 1.5
        volume_change = -(percentage / 100.0) * elasticity
        
        # Calculate new estimated profit impact
        current_impact = metrics.get("estimated_profit_impact", 0.0)
        # Apply the volume elasticity to the impact 
        # (Very simplified for demonstration: profit scales with volume and price margin)
        expected_profit_change = current_impact * (1.0 + (percentage / 100.0)) * (1.0 + volume_change)
        
        inventory_impact = -(volume_change * 100.0) # Inventory depletes slower if volume drops
        
        confidence = ConfidenceEngine.calculate_confidence("price_change")
        
        return {
            "scenario": "Price Change",
            "parameter": f"{percentage}%",
            "new_price": "Aggregated Average +X%", # Placeholder for specific SKU logic
            "new_margin_percent": f"{(percentage * 0.8):.1f}% delta",
            "expected_profit_change": round(expected_profit_change - current_impact, 2),
            "inventory_impact": f"{round(inventory_impact, 1)}%",
            "confidence_score": confidence
        }

    @staticmethod
    def simulate_demand_growth(percentage: float, org_id: int, db: Session) -> Dict[str, Any]:
        metrics = AnalyticsService.get_dashboard_metrics(db, org_id)
        
        # Demand growth compresses stockout dates.
        # If demand grows 20%, stockout dates shrink by ~16% (1/1.2)
        factor = 1.0 + (percentage / 100.0)
        
        # Reorder quantity increases proportionally
        total_reorder_recs = len(metrics.get("reorder_recommendations", []))
        required_qty = int(total_reorder_recs * 100 * factor) # Dummy scalar for 100 units/rec
        working_capital = required_qty * 25.0 # Assume $25 average unit cost
        
        confidence = ConfidenceEngine.calculate_confidence("demand_growth")
        
        return {
            "scenario": "Demand Growth",
            "parameter": f"{percentage}%",
            "new_stockout_dates": f"Reduced by {round((1.0 - (1.0/factor))*100, 1)}%",
            "required_reorder_quantity": required_qty,
            "additional_working_capital": round(working_capital, 2),
            "confidence_score": confidence
        }

    @staticmethod
    def simulate_demand_decline(percentage: float, org_id: int, db: Session) -> Dict[str, Any]:
        metrics = AnalyticsService.get_dashboard_metrics(db, org_id)
        
        # Dead stock risk increases
        dead_stock_risk = "High" if percentage > 15 else "Medium"
        
        # Cash locked in inventory
        total_skus = len(metrics.get("stockout_predictions", []))
        cash_locked = total_skus * 50 * 25.0 * (percentage / 100.0) # Dummy 50 units avg
        
        confidence = ConfidenceEngine.calculate_confidence("demand_decline")
        
        return {
            "scenario": "Demand Decline",
            "parameter": f"{percentage}%",
            "dead_stock_risk": dead_stock_risk,
            "inventory_holding_cost": f"+{percentage}%",
            "cash_locked": round(cash_locked, 2),
            "confidence_score": confidence
        }

    @staticmethod
    def simulate_inventory_expansion(quantity: int, org_id: int, db: Session) -> Dict[str, Any]:
        cash_required = quantity * 25.0 # Average $25 cost
        storage_impact = f"+{round(quantity * 0.1, 1)} cubic meters" # Dummy volume
        
        confidence = ConfidenceEngine.calculate_confidence("inventory_expansion")
        
        return {
            "scenario": "Inventory Expansion",
            "parameter": f"{quantity} units",
            "cash_required": round(cash_required, 2),
            "inventory_risk_change": "-15%", # Reduces stockout risk
            "storage_impact": storage_impact,
            "confidence_score": confidence
        }

    @staticmethod
    def simulate_cash_flow_forecast(days: int, org_id: int, db: Session) -> Dict[str, Any]:
        metrics = AnalyticsService.get_dashboard_metrics(db, org_id)
        
        # Predict cash needed based on reorders
        reorder_items = len(metrics.get("reorder_recommendations", []))
        reorder_cost = reorder_items * 150 * 25.0 # Assume 150 units at $25
        
        working_capital = reorder_cost * 1.2 # Buffer
        
        confidence = ConfidenceEngine.calculate_confidence("cash_flow_forecast")
        
        return {
            "scenario": "Cash Flow Forecast",
            "parameter": f"{days} days",
            "required_working_capital": round(working_capital, 2),
            "reorder_cost": round(reorder_cost, 2),
            "cash_flow_risk": "Moderate" if reorder_cost > 50000 else "Low",
            "confidence_score": confidence
        }
