from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from app.core.cache import cached

import uuid

@cached(ttl=30)
def get_health_score(db: Session, workspace_id: uuid.UUID) -> dict:
    # 1. Gather foundational metrics
    total_clients = db.query(Client).filter(Client.organization_id == workspace_id).count()
    active_clients = db.query(Client).filter(Client.organization_id == workspace_id, Client.status == "active").count()
    
    db.query(Project).filter(Project.organization_id == workspace_id).count()
    db.query(Project).filter(Project.organization_id == workspace_id, Project.status == "active").count()
    
    total_tasks = db.query(Task).filter(Task.organization_id == workspace_id).count()
    completed_tasks = db.query(Task).filter(Task.organization_id == workspace_id, Task.status == "completed").count()
    
    revenue_sum = db.query(func.sum(Revenue.amount)).filter(Revenue.organization_id == workspace_id).scalar() or 0.0
    expense_sum = db.query(func.sum(Expense.amount)).filter(Expense.organization_id == workspace_id).scalar() or 0.0
    profit = revenue_sum - expense_sum

    # 2. Base Calculations
    # Start at 50 if there is literally no data
    score = 50.0 
    strengths = []
    risks = []
    recommendations = []

    if total_clients == 0 and revenue_sum == 0:
        return {
            "score": None,
            "status": "Insufficient data",
            "strengths": [],
            "risks": ["No business activity detected."],
            "recommendations": ["Acquire your first client."]
        }

    # Reset score to calculate from 0 based on real metrics
    score = 0.0

    # Profitability (Weight: 40 points)
    if revenue_sum > 0:
        profit_margin = profit / revenue_sum
        if profit_margin > 0.2:
            score += 40
            strengths.append("High profit margin (>20%)")
        elif profit_margin > 0:
            score += 25
            strengths.append("Profitable operations")
        else:
            score += 0
            risks.append("Negative profit margin")
            recommendations.append("Reduce expenses or increase billable revenue immediately.")
    else:
        risks.append("Zero revenue generated.")
        recommendations.append("Focus on revenue generation.")

    # Task Completion (Weight: 30 points)
    if total_tasks > 0:
        task_rate = completed_tasks / total_tasks
        if task_rate >= 0.8:
            score += 30
            strengths.append("Excellent task throughput (>=80%)")
        elif task_rate >= 0.5:
            score += 15
        else:
            risks.append("Low task completion rate (<50%)")
            recommendations.append("Review project management and team velocity.")
    else:
        score += 15 # Neutral points if no tasks
        
    # Active Clients (Weight: 30 points)
    if total_clients > 0:
        client_rate = active_clients / total_clients
        if active_clients >= 3 and client_rate >= 0.7:
            score += 30
            strengths.append("Strong active client base")
        elif active_clients >= 1:
            score += 20
        else:
            risks.append("No active clients.")
            recommendations.append("Reactivate past clients or acquire new ones.")
    else:
        score += 10 # Neutral points

    # Clamp Score
    score = max(0, min(100, score))

    # Determine Status Category
    if score >= 90:
        status = "excellent"
    elif score >= 75:
        status = "healthy"
    elif score >= 50:
        status = "warning"
    else:
        status = "critical"

    return {
        "score": round(score, 1),
        "status": status,
        "strengths": strengths,
        "risks": risks,
        "recommendations": recommendations
    }
