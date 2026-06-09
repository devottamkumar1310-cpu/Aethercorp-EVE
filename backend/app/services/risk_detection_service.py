from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense

def detect_risks(db: Session) -> dict:
    risks = []
    
    # 1. Negative Profit
    revenue_sum = db.query(func.sum(Revenue.amount)).scalar() or 0.0
    expense_sum = db.query(func.sum(Expense.amount)).scalar() or 0.0
    profit = revenue_sum - expense_sum
    
    if profit < 0:
        risks.append({
            "severity": "high",
            "title": "Negative Profit",
            "description": f"Expenses exceed revenue by ${abs(profit):.2f}."
        })
        
    # High Expense Ratio
    if revenue_sum > 0 and expense_sum > 0:
        if expense_sum / revenue_sum > 0.8:
            risks.append({
                "severity": "medium",
                "title": "High Expense Ratio",
                "description": "Operating expenses are consuming over 80% of revenue."
            })
            
    # 2. Overdue Projects
    # We compare deadline against current date. Note: deadline is a date string or DateTime
    now = datetime.now()
    overdue_projects = db.query(Project).filter(
        Project.status == "active",
        Project.deadline != None,
        Project.deadline < now.strftime("%Y-%m-%d")
    ).all()
    
    if len(overdue_projects) > 0:
        risks.append({
            "severity": "high",
            "title": "Overdue Projects",
            "description": f"{len(overdue_projects)} active project(s) have passed their deadline."
        })
        
    # 3. Overdue Tasks
    overdue_tasks = db.query(Task).filter(
        Task.status != "completed",
        Task.due_date != None,
        Task.due_date < now.strftime("%Y-%m-%d")
    ).all()
    
    if len(overdue_tasks) > 0:
        risks.append({
            "severity": "medium",
            "title": "Overdue Tasks",
            "description": f"{len(overdue_tasks)} pending task(s) are overdue."
        })
        
    # 4. Low Completion Rate
    total_tasks = db.query(Task).count()
    completed_tasks = db.query(Task).filter(Task.status == "completed").count()
    if total_tasks > 0 and (completed_tasks / total_tasks) < 0.5:
        risks.append({
            "severity": "low",
            "title": "Low Task Velocity",
            "description": "Overall task completion rate is below 50%."
        })
        
    # 5. Inactive Clients
    inactive_clients = db.query(Client).filter(Client.status == "inactive").count()
    if inactive_clients > 0:
        risks.append({
            "severity": "low",
            "title": "Inactive Client Retention",
            "description": f"{inactive_clients} client(s) are currently inactive."
        })

    # Sort risks by severity: critical > high > medium > low
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    risks.sort(key=lambda x: severity_order.get(x["severity"], 4))

    return {"risks": risks}
