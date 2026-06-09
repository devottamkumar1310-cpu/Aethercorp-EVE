from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.intelligence_snapshot import IntelligenceSnapshot
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from sqlalchemy import func
from app.services.business_health_service import get_health_score

def create_snapshot(db: Session) -> IntelligenceSnapshot:
    # Gather current metrics
    total_clients = db.query(Client).count()
    active_clients = db.query(Client).filter(Client.status == "active").count()
    
    total_projects = db.query(Project).count()
    active_projects = db.query(Project).filter(Project.status == "active").count()
    
    total_tasks = db.query(Task).count()
    completed_tasks = db.query(Task).filter(Task.status == "completed").count()
    
    revenue_sum = db.query(func.sum(Revenue.amount)).scalar() or 0.0
    expense_sum = db.query(func.sum(Expense.amount)).scalar() or 0.0
    profit = revenue_sum - expense_sum
    
    # Temporarily instantiate the model without health score to avoid circular logic, 
    # but wait, get_health_score just reads the DB. We can call it directly.
    # We need to make sure get_health_score takes db as an argument and returns dict.
    health_data = get_health_score(db)
    health_score = health_data.get("score", 0.0)

    snapshot = IntelligenceSnapshot(
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

def get_recent_snapshots(db: Session, limit: int = 10) -> list[IntelligenceSnapshot]:
    return db.query(IntelligenceSnapshot).order_by(desc(IntelligenceSnapshot.created_at)).limit(limit).all()

def get_latest_snapshot(db: Session) -> IntelligenceSnapshot | None:
    return db.query(IntelligenceSnapshot).order_by(desc(IntelligenceSnapshot.created_at)).first()
