from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.intelligence_snapshot import IntelligenceSnapshot
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from sqlalchemy import func
from app.services.business_health_service import get_health_score

import uuid

def create_snapshot(db: Session, workspace_id: uuid.UUID) -> IntelligenceSnapshot:
    # Gather current metrics
    total_clients = db.query(Client).filter(Client.organization_id == workspace_id).count()
    active_clients = db.query(Client).filter(Client.organization_id == workspace_id, Client.status == "active").count()
    
    total_projects = db.query(Project).filter(Project.organization_id == workspace_id).count()
    active_projects = db.query(Project).filter(Project.organization_id == workspace_id, Project.status == "active").count()
    
    total_tasks = db.query(Task).filter(Task.organization_id == workspace_id).count()
    completed_tasks = db.query(Task).filter(Task.organization_id == workspace_id, Task.status == "completed").count()
    
    revenue_sum = db.query(func.sum(Revenue.amount)).filter(Revenue.organization_id == workspace_id).scalar() or 0.0
    expense_sum = db.query(func.sum(Expense.amount)).filter(Expense.organization_id == workspace_id).scalar() or 0.0
    profit = revenue_sum - expense_sum
    
    health_data = get_health_score(db, workspace_id)
    health_score = health_data.get("score", 0.0)

    # Calculate inventory prioritization aggregates for the snapshot
    from app.services.analytics_service import AnalyticsService
    try:
        inv_analysis = AnalyticsService.get_inventory_analysis(db, workspace_id)
        product_metrics = inv_analysis.get("items_at_risk", [])
        inventory_value = sum(item.get("stock_on_hand", 0) * item.get("unit_cost", 0.0) for item in product_metrics)
        at_risk_skus = sum(1 for item in product_metrics if item.get("stockout_risk_score", 0.0) >= 70.0)
        dead_stock_skus = sum(1 for item in product_metrics if item.get("is_dead_stock", False))
        revenue_at_risk = sum(item.get("revenue_at_risk", 0.0) for item in product_metrics)
        working_capital_locked = sum(item.get("working_capital_locked", 0.0) for item in product_metrics)
        
        # Phase 3 priority counts
        business_health_score = inv_analysis.get("business_health_score", int(health_score))
        top_risk_count = len(inv_analysis.get("top_risks", []))
        top_opportunity_count = len(inv_analysis.get("top_opportunities", []))
        top_action_count = len(inv_analysis.get("top_actions", []))
    except Exception:
        inventory_value = 0.0
        at_risk_skus = 0
        dead_stock_skus = 0
        revenue_at_risk = 0.0
        working_capital_locked = 0.0
        business_health_score = int(health_score)
        top_risk_count = 0
        top_opportunity_count = 0
        top_action_count = 0

    snapshot = IntelligenceSnapshot(
        organization_id=workspace_id,
        health_score=health_score,
        total_clients=total_clients,
        active_clients=active_clients,
        total_projects=total_projects,
        active_projects=active_projects,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        revenue=revenue_sum,
        expenses=expense_sum,
        profit=profit,
        inventory_value=inventory_value,
        at_risk_skus=at_risk_skus,
        dead_stock_skus=dead_stock_skus,
        revenue_at_risk=revenue_at_risk,
        working_capital_locked=working_capital_locked,
        business_health_score=business_health_score,
        top_risk_count=top_risk_count,
        top_opportunity_count=top_opportunity_count,
        top_action_count=top_action_count
    )
    
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot

def get_recent_snapshots(db: Session, workspace_id: uuid.UUID, limit: int = 10) -> list[IntelligenceSnapshot]:
    return db.query(IntelligenceSnapshot).filter(IntelligenceSnapshot.organization_id == workspace_id).order_by(desc(IntelligenceSnapshot.created_at)).limit(limit).all()

def get_latest_snapshot(db: Session, workspace_id: uuid.UUID) -> IntelligenceSnapshot | None:
    return db.query(IntelligenceSnapshot).filter(IntelligenceSnapshot.organization_id == workspace_id).order_by(desc(IntelligenceSnapshot.created_at)).first()
