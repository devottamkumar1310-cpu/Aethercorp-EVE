import logging
import uuid
import traceback
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.system_error import SystemError

logger = logging.getLogger("eve.services.error_monitoring_service")

class ErrorMonitoringService:
    @staticmethod
    def log_error(
        db: Session,
        component: str,
        error_type: str,
        message: str,
        stack_trace: Optional[str] = None,
        org_id: Optional[uuid.UUID] = None,
        metadata_json: Optional[Dict[str, Any]] = None
    ) -> SystemError:
        """
        Saves a system-level error to the database.
        """
        try:
            # If stack trace is not provided, try to extract it from context if we are in an except block
            if not stack_trace:
                stack_trace = traceback.format_exc()
                if "NoneType: None" in stack_trace:
                    stack_trace = None
            
            error_log = SystemError(
                organization_id=org_id,
                component=component,
                error_type=error_type,
                message=message,
                stack_trace=stack_trace,
                metadata_json=metadata_json
            )
            db.add(error_log)
            db.commit()
            db.refresh(error_log)
            return error_log
        except Exception as e:
            logger.critical(f"Failed to write error to database: {e}", exc_info=True)
            # Fallback warning
            logger.error(f"[SYSTEM ERROR LOG] {component} | {error_type} | {message}")
            return None

    @staticmethod
    def get_errors(db: Session, skip: int = 0, limit: int = 50, org_id: Optional[uuid.UUID] = None) -> List[SystemError]:
        """
        Fetches system errors sorted by newest. Optionally filters by organization_id.
        """
        from sqlalchemy import desc
        query = db.query(SystemError)
        if org_id:
            query = query.filter(SystemError.organization_id == org_id)
        return query.order_by(desc(SystemError.created_at)).offset(skip).limit(limit).all()
