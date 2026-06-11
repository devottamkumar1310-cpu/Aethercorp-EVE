from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.models.intelligence_snapshot import IntelligenceSnapshot
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from app.services.business_health_service import get_health_score
from app.core.cache import cached

import uuid

@cached(ttl=30)
def calculate_trends(db: Session, workspace_id: uuid.UUID) -> dict:
    snapshots = db.query(IntelligenceSnapshot).filter(IntelligenceSnapshot.organization_id == workspace_id).order_by(desc(IntelligenceSnapshot.created_at)).limit(2).all()
    
    # We need 'current' and 'previous' to compare.
    # If we have 2 snapshots, we use them.
    # If we have 1 snapshot, we compare real-time data against it.
    # If 0 snapshots, we just return 'stable' for everything.

    def get_trend(current_val: float, prev_val: float) -> str:
        if current_val > prev_val:
            return "up"
        elif current_val < prev_val:
            return "down"
        return "stable"

    if len(snapshots) >= 2:
        current = snapshots[0]
        previous = snapshots[1]
        
        curr_task_rate = current.completed_tasks / max(1, current.total_tasks)
        prev_task_rate = previous.completed_tasks / max(1, previous.total_tasks)
        
        return {
            "revenue_trend": get_trend(current.revenue, previous.revenue),
            "expense_trend": get_trend(current.expenses, previous.expenses),
            "profit_trend": get_trend(current.profit, previous.profit),
            "health_trend": get_trend(current.health_score, previous.health_score),
            "task_trend": get_trend(curr_task_rate, prev_task_rate)
        }
        
    elif len(snapshots) == 1:
        previous = snapshots[0]
        
        # Real-time metrics
        revenue_sum = db.query(func.sum(Revenue.amount)).filter(Revenue.organization_id == workspace_id).scalar() or 0.0
        expense_sum = db.query(func.sum(Expense.amount)).filter(Expense.organization_id == workspace_id).scalar() or 0.0
        profit = revenue_sum - expense_sum
        
        total_tasks = db.query(Task).filter(Task.organization_id == workspace_id).count()
        completed_tasks = db.query(Task).filter(Task.organization_id == workspace_id, Task.status == "completed").count()
        curr_task_rate = completed_tasks / max(1, total_tasks)
        prev_task_rate = previous.completed_tasks / max(1, previous.total_tasks)
        
        health_data = get_health_score(db, workspace_id)
        
        return {
            "revenue_trend": get_trend(revenue_sum, previous.revenue),
            "expense_trend": get_trend(expense_sum, previous.expenses),
            "profit_trend": get_trend(profit, previous.profit),
            "health_trend": get_trend(health_data.get("score", 0.0), previous.health_score),
            "task_trend": get_trend(curr_task_rate, prev_task_rate)
        }
        
    # Fallback heuristics if no snapshots exist at all
    return {
        "revenue_trend": "stable",
        "expense_trend": "stable",
        "profit_trend": "stable",
        "health_trend": "stable",
        "task_trend": "stable"
    }
