import logging
import uuid
from sqlalchemy.orm import Session
from app.models.activity_log import ActivityLog

logger = logging.getLogger("eve.activity")

class ActivityService:
    @staticmethod
    def log_activity(db: Session, user_id: uuid.UUID, organization_id: uuid.UUID, entity_type: str, entity_id: uuid.UUID, action: str, description: str = None):
        """
        Creates an activity log entry and adds it to the session.
        The caller is responsible for committing the session.
        """
        log_entry = ActivityLog(
            user_id=user_id,
            organization_id=organization_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            description=description
        )
        db.add(log_entry)
        return log_entry

    @staticmethod
    def get_activities(db: Session, workspace_id: uuid.UUID, skip: int = 0, limit: int = 100, user_id: uuid.UUID = None):
        from sqlalchemy import desc
        query = db.query(ActivityLog).filter(ActivityLog.organization_id == workspace_id).order_by(desc(ActivityLog.created_at))
        if user_id:
            query = query.filter(ActivityLog.user_id == user_id)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_activity(db: Session, activity_id: uuid.UUID, workspace_id: uuid.UUID):
        return db.query(ActivityLog).filter(ActivityLog.id == activity_id, ActivityLog.organization_id == workspace_id).first()
