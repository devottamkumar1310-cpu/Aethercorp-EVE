from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from app.services.business_health_service import get_health_score

def generate_summary(db: Session) -> dict:
    health = get_health_score(db)
    
    active_clients = db.query(Client).filter(Client.status == "active").count()
    active_projects = db.query(Project).filter(Project.status == "active").count()
    
    revenue_sum = db.query(func.sum(Revenue.amount)).scalar() or 0.0
    expense_sum = db.query(func.sum(Expense.amount)).scalar() or 0.0
    profit = revenue_sum - expense_sum
    
    total_tasks = db.query(Task).count()
    completed_tasks = db.query(Task).filter(Task.status == "completed").count()

    sentences = []
    
    # Sentence 1: General Health
    if health["status"] == "excellent":
        sentences.append("Business operations are performing exceptionally well.")
    elif health["status"] == "healthy":
        sentences.append("Business operations remain healthy.")
    elif health["status"] == "warning":
        sentences.append("Business operations are showing signs of strain.")
    else:
        sentences.append("Business operations are in critical condition and require immediate intervention.")
        
    # Sentence 2: Activity
    sentences.append(f"Currently tracking {active_clients} active client{'s' if active_clients != 1 else ''} and {active_projects} active project{'s' if active_projects != 1 else ''}.")
    
    # Sentence 3: Financials
    if profit > 0:
        sentences.append("Revenue exceeds expenses, maintaining profitability.")
    elif profit < 0:
        sentences.append("Expenses currently exceed revenue, resulting in a net loss.")
    else:
        sentences.append("Revenue and expenses are currently balanced.")
        
    # Sentence 4: Tasks
    if total_tasks > 0:
        task_rate = completed_tasks / total_tasks
        if task_rate >= 0.8:
            sentences.append("Task completion rate is high, indicating strong operational velocity.")
        elif task_rate < 0.5:
            sentences.append("Task completion remains low and requires attention to prevent project delays.")
        else:
            sentences.append("Task completion is proceeding at a moderate pace.")
            
    summary_text = " ".join(sentences)
    
    return {"summary": summary_text}
