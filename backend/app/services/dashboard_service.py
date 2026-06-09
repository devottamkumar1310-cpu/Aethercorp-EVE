from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.client import Client
from app.models.project import Project
from app.services.business_analytics_service import BusinessAnalyticsService

class DashboardService:
    @staticmethod
    def get_kpis(db: Session) -> dict:
        return BusinessAnalyticsService.get_overview(db)

    @staticmethod
    def get_recent_clients(db: Session, limit: int = 5) -> list:
        clients = db.query(Client).order_by(desc(Client.created_at)).limit(limit).all()
        return clients

    @staticmethod
    def get_recent_projects(db: Session, limit: int = 5) -> list:
        projects = db.query(Project).order_by(desc(Project.created_at)).limit(limit).all()
        return projects

    @staticmethod
    def get_upcoming_deadlines(db: Session, limit: int = 5) -> list:
        projects = db.query(Project).filter(
            Project.status.in_(["planned", "active"]),
            Project.deadline != None
        ).order_by(Project.deadline).limit(limit).all()
        return projects

    @staticmethod
    def get_summary(db: Session) -> dict:
        return {
            "kpis": DashboardService.get_kpis(db),
            "recent_clients": DashboardService.get_recent_clients(db),
            "recent_projects": DashboardService.get_recent_projects(db),
            "upcoming_deadlines": DashboardService.get_upcoming_deadlines(db)
        }
