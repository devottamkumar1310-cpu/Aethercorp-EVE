from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.services.audit_service import AuditService

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
        Backward-compatible delegate calling the centralized AuditService.
        """
        return AuditService.log(
            db=db,
            event_type=event_type,
            status=status,
            organization_id=organization_id,
            message=message,
            metadata_json=metadata_json,
            commit=commit
        )
