import logging
import uuid
import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

logger = logging.getLogger("eve.services.audit_logger")

class AuditLogger:
    @staticmethod
    def log(
        db: Session,
        event_type: str,
        status: str,
        organization_id: Optional[Any] = None,
        message: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
        commit: bool = True
    ) -> Optional[AuditLog]:
        """
        Creates and persists a compliance audit log entry in the database.
        """
        try:
            # Safely coerce organization_id to a UUID if it's passed as a string
            if isinstance(organization_id, str):
                try:
                    organization_id = uuid.UUID(organization_id)
                except ValueError:
                    logger.warning(f"Could not parse organization_id string to UUID: {organization_id}")
            
            log_entry = AuditLog(
                organization_id=organization_id,
                event_type=event_type,
                status=status,
                message=message,
                metadata_json=metadata_json,
                created_at=datetime.datetime.utcnow()
            )
            db.add(log_entry)
            if commit:
                db.commit()
                db.refresh(log_entry)
            else:
                db.flush()
            
            logger.info(f"[AUDIT LOG] {event_type} | Status: {status} | Org: {organization_id} | Msg: {message}")
            return log_entry
        except Exception as e:
            logger.error(f"Failed to write audit log entry: {e}", exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass
            return None
