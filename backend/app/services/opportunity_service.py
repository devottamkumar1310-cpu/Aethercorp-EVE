from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from app.models.intelligence_snapshot import IntelligenceSnapshot
from sqlalchemy import desc
from app.core.cache import cached

import uuid

@cached(ttl=30)
def detect_opportunities(db: Session, workspace_id: uuid.UUID) -> dict:
    opportunities = []
    
    # Base Data
    revenue_sum = db.query(func.sum(Revenue.amount)).filter(Revenue.organization_id == workspace_id).scalar() or 0.0
    expense_sum = db.query(func.sum(Expense.amount)).filter(Expense.organization_id == workspace_id).scalar() or 0.0
    profit = revenue_sum - expense_sum
    
    active_projects = db.query(Project).filter(Project.organization_id == workspace_id, Project.status == "active").count()
    completed_projects = db.query(Project).filter(Project.organization_id == workspace_id, Project.status == "completed").count()
    
    # 1. Increasing Profitability
    if revenue_sum > 0 and (profit / revenue_sum) > 0.3:
        opportunities.append({
            "title": "High Profitability",
            "description": "Profit margins exceed 30%. Consider reinvesting in growth or marketing."
        })
        
    # 2. Revenue Momentum (Requires Snapshots)
    snapshots = db.query(IntelligenceSnapshot).filter(IntelligenceSnapshot.organization_id == workspace_id).order_by(desc(IntelligenceSnapshot.created_at)).limit(2).all()
    if len(snapshots) == 2:
        current, previous = snapshots[0], snapshots[1]
        rev_growth = current.revenue - previous.revenue
        if rev_growth > 0 and current.expenses <= previous.expenses:
            opportunities.append({
                "title": "Revenue Momentum",
                "description": "Revenue is growing while expenses remain stable or are decreasing."
            })
            
    # 3. Underutilized Capacity (High Task Completion, Low Active Projects)
    total_tasks = db.query(Task).filter(Task.organization_id == workspace_id).count()
    completed_tasks = db.query(Task).filter(Task.organization_id == workspace_id, Task.status == "completed").count()
    if total_tasks > 0 and (completed_tasks / total_tasks) >= 0.8:
        if active_projects <= 2:
            opportunities.append({
                "title": "Underutilized Capacity",
                "description": "High task completion rate suggests bandwidth to onboard new projects."
            })
            
    # 4. Client Expansion
    if completed_projects > 0:
        opportunities.append({
            "title": "Client Retention",
            "description": "Successfully completed projects exist. Opportunity to upsell or request referrals."
        })

    return {"opportunities": opportunities}
