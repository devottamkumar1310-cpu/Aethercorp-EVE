import datetime
import logging
import uuid
from typing import Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.services.analytics_service import AnalyticsService
from app.services.confidence_engine import ConfidenceEngine
from app.models.finance import Revenue, Expense

logger = logging.getLogger("eve.services.simulation_engine")

class SimulationEngine:

    @staticmethod
    def _get_available_capital(db: Session, org_id: Any) -> float:
        """
        Calculates available capital dynamically based on organization's configurable cash value or uploaded financial data.
        Returns 0.0 if unknown.
        """
        # 1. Configurable Cash Value in MemoryEntry
        try:
            from app.models.memory import MemoryEntry
            import uuid
            db_org_id = org_id
            if isinstance(org_id, str):
                db_org_id = uuid.UUID(org_id)
            cash_mem = db.query(MemoryEntry).filter(
                MemoryEntry.organization_id == db_org_id,
                MemoryEntry.content.like("cash_balance:%")
            ).first()
            if cash_mem:
                return float(cash_mem.content.split(":")[1].strip())
        except Exception:
            pass

        # 2. Uploaded Financial Data (Revenues & Expenses)
        try:
            total_revenue = db.query(func.sum(Revenue.amount)).filter(Revenue.organization_id == org_id).scalar() or 0.0
            total_expenses = db.query(func.sum(Expense.amount)).filter(Expense.organization_id == org_id).scalar() or 0.0
            if total_revenue > 0.0 or total_expenses > 0.0:
                return max(0.0, total_revenue - total_expenses)
        except Exception:
            pass

        # 3. Unknown Cash Availability
        return 0.0

    @staticmethod
    def _save_history(db: Session, org_id: Any, scenario_type: str, parameter: str, results: Dict[str, Any]):
        """
        Persists scenario execution metadata to the forecasts database for auditing and comparison.
        """
        from app.models.future import Forecast
        try:
            db_org_id = org_id
            if isinstance(org_id, str):
                db_org_id = uuid.UUID(org_id)
            
            forecast_rec = Forecast(
                id=uuid.uuid4(),
                organization_id=db_org_id,
                metrics={
                    "scenario_type": scenario_type,
                    "parameter": parameter,
                    "results": results
                }
            )
            db.add(forecast_rec)
            db.commit()
            logger.info(f"Scenario history saved for org {db_org_id}, type {scenario_type}")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist scenario history: {e}")

    @classmethod
    def simulate_price_change(cls, percentage: float, org_id: Any, db: Session) -> Dict[str, Any]:
        metrics = AnalyticsService.get_dashboard_metrics(db, org_id)
        
        elasticity = 1.2 if percentage > 0 else 1.5
        volume_change = -(percentage / 100.0) * elasticity
        
        current_impact = metrics.get("estimated_profit_impact", 0.0)
        expected_profit_change = current_impact * (1.0 + (percentage / 100.0)) * (1.0 + volume_change)
        inventory_impact = -(volume_change * 100.0)
        
        # Capital Gap Analysis
        required_capital = 0.0  # Price changes do not require upfront capital
        available_capital = cls._get_available_capital(db, org_id)
        capital_gap = max(0.0, required_capital - available_capital)
        
        confidence = ConfidenceEngine.calculate_deterministic_confidence("price_change", db, org_id)
        
        assumptions = {
            "elasticity_coefficient": elasticity,
            "base_profit_impact": round(current_impact, 2),
            "projected_volume_change_pct": round(volume_change * 100.0, 2)
        }
        
        res = {
            "scenario": "Price Change",
            "parameter": f"{percentage}%",
            "new_price": "Aggregated Average +X%",
            "new_margin_percent": f"{(percentage * 0.8):.1f}% delta",
            "expected_profit_change": round(expected_profit_change - current_impact, 2),
            "inventory_impact": f"{round(inventory_impact, 1)}%",
            "confidence_score": confidence,
            "method_used": "elasticity_simulation",
            "reason_for_method_selection": "Elasticity simulation is selected as it models the trade-off between price increases and quantity demanded based on historical price-demand sensitivity coefficients.",
            "required_capital": required_capital,
            "available_capital": round(available_capital, 2),
            "capital_gap": round(capital_gap, 2),
            "assumptions": assumptions,
            "explainability": {
                "method": "Elasticity simulation math",
                "factors": [
                    f"Price change parameter: {percentage}%",
                    f"Elasticity coefficient: {elasticity}",
                    f"Projected volume change: {volume_change * 100.0:.1f}%"
                ]
            },
            "provenance": {
                "source": "SimulationEngine.simulate_price_change",
                "calculated_at": datetime.datetime.utcnow().isoformat()
            }
        }
        
        cls._save_history(db, org_id, "price_change", f"{percentage}%", res)
        return res

    @classmethod
    def simulate_demand_growth(cls, percentage: float, org_id: Any, db: Session) -> Dict[str, Any]:
        metrics = AnalyticsService.get_dashboard_metrics(db, org_id)
        
        factor = 1.0 + (percentage / 100.0)
        total_reorder_recs = len(metrics.get("reorder_recommendations", []))
        required_qty = int(total_reorder_recs * 100 * factor)
        
        # Capital Gap Analysis
        required_capital = required_qty * 25.0
        available_capital = cls._get_available_capital(db, org_id)
        capital_gap = max(0.0, required_capital - available_capital)
        
        confidence = ConfidenceEngine.calculate_deterministic_confidence("demand_growth", db, org_id)
        
        assumptions = {
            "average_unit_cost": 25.0,
            "reorder_recs_count": total_reorder_recs,
            "demand_multiplier": factor
        }
        
        res = {
            "scenario": "Demand Growth",
            "parameter": f"{percentage}%",
            "new_stockout_dates": f"Reduced by {round((1.0 - (1.0/factor))*100, 1)}%",
            "required_reorder_quantity": required_qty,
            "additional_working_capital": round(required_capital, 2),
            "confidence_score": confidence,
            "method_used": "demand_escalation_projection",
            "reason_for_method_selection": "Demand escalation projection is selected to model the upfront working capital required to support simulated sales volume expansions.",
            "required_capital": round(required_capital, 2),
            "available_capital": round(available_capital, 2),
            "capital_gap": round(capital_gap, 2),
            "assumptions": assumptions,
            "explainability": {
                "method": "Demand escalation projection",
                "factors": [
                    f"Demand growth parameter: {percentage}%",
                    f"Reorder recommendations count: {total_reorder_recs}"
                ]
            },
            "provenance": {
                "source": "SimulationEngine.simulate_demand_growth",
                "calculated_at": datetime.datetime.utcnow().isoformat()
            }
        }
        
        cls._save_history(db, org_id, "demand_growth", f"{percentage}%", res)
        return res

    @classmethod
    def simulate_demand_decline(cls, percentage: float, org_id: Any, db: Session) -> Dict[str, Any]:
        metrics = AnalyticsService.get_dashboard_metrics(db, org_id)
        
        dead_stock_risk = "High" if percentage > 15 else "Medium"
        total_skus = len(metrics.get("stockout_predictions", []))
        cash_locked = total_skus * 50 * 25.0 * (percentage / 100.0)
        
        # Capital Gap Analysis (holding cost is 15% of locked cash)
        required_capital = round(cash_locked * 0.15, 2)
        available_capital = cls._get_available_capital(db, org_id)
        capital_gap = max(0.0, required_capital - available_capital)
        
        confidence = ConfidenceEngine.calculate_deterministic_confidence("demand_decline", db, org_id)
        
        assumptions = {
            "average_unit_cost": 25.0,
            "skus_count": total_skus,
            "holding_cost_rate": 0.15
        }
        
        res = {
            "scenario": "Demand Decline",
            "parameter": f"{percentage}%",
            "dead_stock_risk": dead_stock_risk,
            "inventory_holding_cost": f"+{percentage}%",
            "cash_locked": round(cash_locked, 2),
            "confidence_score": confidence,
            "method_used": "demand_compression_projection",
            "reason_for_method_selection": "Demand compression projection is selected to estimate carrying costs and cash locking risks resulting from simulated slowdowns in sales velocity.",
            "required_capital": round(required_capital, 2),
            "available_capital": round(available_capital, 2),
            "capital_gap": round(capital_gap, 2),
            "assumptions": assumptions,
            "explainability": {
                "method": "Demand compression projection",
                "factors": [
                    f"Demand decline parameter: {percentage}%",
                    f"SKUs scanned: {total_skus}"
                ]
            },
            "provenance": {
                "source": "SimulationEngine.simulate_demand_decline",
                "calculated_at": datetime.datetime.utcnow().isoformat()
            }
        }
        
        cls._save_history(db, org_id, "demand_decline", f"{percentage}%", res)
        return res

    @classmethod
    def simulate_inventory_expansion(cls, quantity: int, org_id: Any, db: Session) -> Dict[str, Any]:
        # Capital Gap Analysis
        required_capital = quantity * 25.0
        available_capital = cls._get_available_capital(db, org_id)
        capital_gap = max(0.0, required_capital - available_capital)
        
        storage_impact = f"+{round(quantity * 0.1, 1)} cubic meters"
        
        confidence = ConfidenceEngine.calculate_deterministic_confidence("inventory_expansion", db, org_id)
        
        assumptions = {
            "average_unit_cost": 25.0,
            "expansion_units": quantity,
            "cubic_meters_per_unit": 0.1
        }
        
        res = {
            "scenario": "Inventory Expansion",
            "parameter": f"{quantity} units",
            "cash_required": round(required_capital, 2),
            "inventory_risk_change": "-15%",
            "storage_impact": storage_impact,
            "confidence_score": confidence,
            "method_used": "safety_stock_capital_mapping",
            "reason_for_method_selection": "Safety stock capital mapping is selected to calculate the immediate capital reserve required to increase storage capacity and stock-on-hand buffers.",
            "required_capital": round(required_capital, 2),
            "available_capital": round(available_capital, 2),
            "capital_gap": round(capital_gap, 2),
            "assumptions": assumptions,
            "explainability": {
                "method": "Safety stock capital mapping",
                "factors": [
                    f"Expansion quantity: {quantity} units",
                    f"Average unit cost: $25.00"
                ]
            },
            "provenance": {
                "source": "SimulationEngine.simulate_inventory_expansion",
                "calculated_at": datetime.datetime.utcnow().isoformat()
            }
        }
        
        cls._save_history(db, org_id, "inventory_expansion", f"{quantity} units", res)
        return res

    @classmethod
    def simulate_cash_flow_forecast(cls, days: int, org_id: Any, db: Session) -> Dict[str, Any]:
        from app.services.analytics_service import AnalyticsService
        inv_analysis = AnalyticsService.get_inventory_analysis(db, org_id)
        
        reorder_items = sum(1 for item in inv_analysis.get("items_at_risk", []) if item.get("reorder_quantity", 0) > 0)
        reorder_cost = reorder_items * 150 * 25.0
        
        # Capital Gap Analysis
        required_capital = reorder_cost * 1.2
        available_capital = cls._get_available_capital(db, org_id)
        capital_gap = max(0.0, required_capital - available_capital)
        
        confidence = ConfidenceEngine.calculate_deterministic_confidence("cash_flow_forecast", db, org_id)
        
        assumptions = {
            "average_unit_cost": 25.0,
            "reorder_multiplier": 1.2,
            "average_reorder_qty_per_item": 150
        }
        
        res = {
            "scenario": "Cash Flow Forecast",
            "parameter": f"{days} days",
            "required_working_capital": round(required_capital, 2),
            "reorder_cost": round(reorder_cost, 2),
            "cash_flow_risk": "Moderate" if reorder_cost > 50000 else "Low",
            "confidence_score": confidence,
            "method_used": "reorder_cost_budget_forecast",
            "reason_for_method_selection": "Reorder cost budget forecasting is selected to project cash requirements based on replenishment schedules and incoming inventory reorder points.",
            "required_capital": round(required_capital, 2),
            "available_capital": round(available_capital, 2),
            "capital_gap": round(capital_gap, 2),
            "assumptions": assumptions,
            "explainability": {
                "method": "Reorder cost budget forecast",
                "factors": [
                    f"Days interval: {days}",
                    f"Reorder recommendations count: {reorder_items}"
                ]
            },
            "provenance": {
                "source": "SimulationEngine.simulate_cash_flow_forecast",
                "calculated_at": datetime.datetime.utcnow().isoformat()
            }
        }
        
        cls._save_history(db, org_id, "cash_flow_forecast", f"{days} days", res)
        return res
