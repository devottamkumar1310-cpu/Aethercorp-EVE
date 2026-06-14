import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.finance import Revenue, Expense
from app.models.inventory import InventoryItem

class BusinessAnalyticsService:
    @staticmethod
    def get_overview(db: Session, organization_id: uuid.UUID) -> dict:
        """
        Aggregates KPIs for the Business Operations Engine.
        Designed to be easily extensible for future metrics.
        """
        # Client Metrics
        total_clients = db.query(Client).filter(Client.organization_id == organization_id).count()
        active_clients = db.query(Client).filter(Client.organization_id == organization_id, Client.status == "active").count()
        
        # Project Metrics
        total_projects = db.query(Project).filter(Project.organization_id == organization_id).count()
        active_projects = db.query(Project).filter(Project.organization_id == organization_id, Project.status == "active").count()
        
        # Task Metrics
        total_tasks = db.query(Task).filter(Task.organization_id == organization_id).count()
        completed_tasks = db.query(Task).filter(Task.organization_id == organization_id, Task.status == "completed").count()
        
        # Financial Metrics
        total_revenue = db.query(func.sum(Revenue.amount)).filter(Revenue.organization_id == organization_id).scalar() or 0.0
        total_expenses = db.query(func.sum(Expense.amount)).filter(Expense.organization_id == organization_id).scalar() or 0.0
        net_profit = total_revenue - total_expenses
        
        # Inventory Metrics
        total_inventory = db.query(InventoryItem).filter(InventoryItem.organization_id == organization_id).count()
        
        return {
            "clients": total_clients,
            "active_clients": active_clients,
            "projects": total_projects,
            "active_projects": active_projects,
            "tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "revenue": total_revenue,
            "expenses": total_expenses,
            "profit": net_profit,
            "inventory": total_inventory
        }
