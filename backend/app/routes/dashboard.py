import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.profile import Profile
from app.services.analytics_service import AnalyticsService
from app.services.simulation_engine import SimulationEngine
from app.core.security import get_current_user, get_active_workspace_id, get_required_workspace_id

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: Optional[uuid.UUID] = Depends(get_active_workspace_id)
):
    """
    Returns the overarching Business Intelligence dashboard metrics for the organization.
    If the user does not belong to a workspace, returns an empty state payload.
    """
    if not workspace_id:
        return {
            "inventory_risk_score": 0.0,
            "dead_stock_items": [],
            "stockout_predictions": [],
            "reorder_recommendations": [],
            "pricing_recommendations": [],
            "estimated_profit_impact": 0.0,
            "cash_flow_forecast": None,
            "top_3_actions": []
        }

    try:
        metrics = AnalyticsService.get_dashboard_metrics(db, workspace_id)
        
        # Inject Cash Flow Forecast
        cash_flow = SimulationEngine.simulate_cash_flow_forecast(30, workspace_id, db)
        metrics["cash_flow_forecast"] = cash_flow
        
        # Inject Top 3 Actions
        top_actions = []
        if metrics.get("reorder_recommendations"):
            qty = sum(rec.get("recommended_reorder", 0) if isinstance(rec, dict) else rec for rec in metrics["reorder_recommendations"])
            top_actions.append({
                "action": f"Reorder {qty} units immediately",
                "impact": "Prevent stockout revenue loss",
                "confidence_score": 92
            })
        if metrics.get("pricing_recommendations"):
            first_rec = metrics["pricing_recommendations"][0]
            top_actions.append({
                "action": f"Adjust {first_rec.get('sku')} price to ${first_rec.get('recommended_price')}",
                "impact": "Margin optimization",
                "confidence_score": 88
            })
        if metrics.get("dead_stock_items"):
            top_actions.append({
                "action": f"Liquidate {len(metrics['dead_stock_items'])} dead stock SKUs",
                "impact": "Free up warehouse capital",
                "confidence_score": 95
            })
        if not top_actions:
            top_actions = [{"action": "Maintain current operations", "impact": "Stable", "confidence_score": 99}]
            
        metrics["top_3_actions"] = top_actions[:3]
        
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.services.dashboard_service import DashboardService

@router.get("/kpis")
def get_dashboard_kpis(
    db: Session = Depends(get_db), 
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return DashboardService.get_kpis(db, workspace_id)

@router.get("/recent-clients")
def get_dashboard_recent_clients(
    db: Session = Depends(get_db), 
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return DashboardService.get_recent_clients(db, workspace_id)

@router.get("/recent-projects")
def get_dashboard_recent_projects(
    db: Session = Depends(get_db), 
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return DashboardService.get_recent_projects(db, workspace_id)

@router.get("/upcoming-deadlines")
def get_dashboard_upcoming_deadlines(
    db: Session = Depends(get_db), 
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return DashboardService.get_upcoming_deadlines(db, workspace_id)

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db), 
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return DashboardService.get_summary(db, workspace_id)
