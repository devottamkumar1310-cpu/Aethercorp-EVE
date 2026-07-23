import uuid
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.client import Client
from app.models.project import Project
from app.services.business_analytics_service import BusinessAnalyticsService

class DashboardService:
    @staticmethod
    def get_kpis(db: Session, organization_id: uuid.UUID) -> dict:
        return BusinessAnalyticsService.get_overview(db, organization_id)

    @staticmethod
    def get_recent_clients(db: Session, organization_id: uuid.UUID, limit: int = 5) -> list:
        clients = db.query(Client).filter(Client.organization_id == organization_id).order_by(desc(Client.created_at)).limit(limit).all()
        return clients

    @staticmethod
    def get_recent_projects(db: Session, organization_id: uuid.UUID, limit: int = 5) -> list:
        projects = db.query(Project).filter(Project.organization_id == organization_id).order_by(desc(Project.created_at)).limit(limit).all()
        return projects

    @staticmethod
    def get_upcoming_deadlines(db: Session, organization_id: uuid.UUID, limit: int = 5) -> list:
        projects = db.query(Project).filter(
            Project.organization_id == organization_id,
            Project.status.in_(["planned", "active"]),
            Project.deadline.isnot(None)
        ).order_by(Project.deadline).limit(limit).all()
        return projects

    @staticmethod
    def get_summary(db: Session, organization_id: uuid.UUID) -> dict:
        return {
            "kpis": DashboardService.get_kpis(db, organization_id),
            "recent_clients": DashboardService.get_recent_clients(db, organization_id),
            "recent_projects": DashboardService.get_recent_projects(db, organization_id),
            "upcoming_deadlines": DashboardService.get_upcoming_deadlines(db, organization_id)
        }
