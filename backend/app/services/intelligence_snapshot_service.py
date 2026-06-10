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
        profit=profit
    )
    
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot

def get_recent_snapshots(db: Session, workspace_id: uuid.UUID, limit: int = 10) -> list[IntelligenceSnapshot]:
    return db.query(IntelligenceSnapshot).filter(IntelligenceSnapshot.organization_id == workspace_id).order_by(desc(IntelligenceSnapshot.created_at)).limit(limit).all()

def get_latest_snapshot(db: Session, workspace_id: uuid.UUID) -> IntelligenceSnapshot | None:
    return db.query(IntelligenceSnapshot).filter(IntelligenceSnapshot.organization_id == workspace_id).order_by(desc(IntelligenceSnapshot.created_at)).first()
