import logging
import uuid
import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

logger = logging.getLogger("eve.services.audit_service")

class AuditService:
    @staticmethod
    def log(
        db: Session,
        event_type: str,
        status: str,
        organization_id: Optional[Any] = None,
        user_id: Optional[Any] = None,
        client_ip: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
        commit: bool = True
    ) -> Optional[AuditLog]:
        """
        Creates and persists a compliance audit log entry in the database.
        """
        try:
            # Coerce organization_id to a UUID if it's passed as a string
            if isinstance(organization_id, str):
                try:
                    organization_id = uuid.UUID(organization_id)
                except ValueError:
                    logger.warning(f"Could not parse organization_id string to UUID: {organization_id}")

            # Coerce user_id to a UUID if passed as a string
            if isinstance(user_id, str):
                try:
                    user_id = uuid.UUID(user_id)
                except ValueError:
                    logger.warning(f"Could not parse user_id string to UUID: {user_id}")

            log_entry = AuditLog(
                organization_id=organization_id,
                user_id=user_id,
                event_type=event_type,
                status=status,
                message=message,
                client_ip=client_ip,
                before_state=before_state,
                after_state=after_state,
                metadata_json=metadata_json,
                created_at=datetime.datetime.utcnow()
            )
            db.add(log_entry)
            if commit:
                db.commit()
                db.refresh(log_entry)
            else:
                db.flush()

            logger.info(f"[AUDIT LOG] {event_type} | User: {user_id} | Org: {organization_id} | IP: {client_ip} | Status: {status}")
            return log_entry
        except Exception as e:
            logger.error(f"Failed to write audit log entry: {e}", exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass
            return None

    @classmethod
    def log_create(
        cls,
        db: Session,
        user_id: Any,
        organization_id: Any,
        event_type: str,
        after_state: Dict[str, Any],
        client_ip: Optional[str] = None,
        message: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
    ) -> Optional[AuditLog]:
        return cls.log(
            db=db,
            event_type=event_type,
            status="SUCCESS",
            organization_id=organization_id,
            user_id=user_id,
            client_ip=client_ip,
            after_state=after_state,
            message=message or f"Created resource of type {event_type}",
            metadata_json=metadata_json
        )

    @classmethod
    def log_update(
        cls,
        db: Session,
        user_id: Any,
        organization_id: Any,
        event_type: str,
        before_state: Dict[str, Any],
        after_state: Dict[str, Any],
        client_ip: Optional[str] = None,
        message: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
    ) -> Optional[AuditLog]:
        return cls.log(
            db=db,
            event_type=event_type,
            status="SUCCESS",
            organization_id=organization_id,
            user_id=user_id,
            client_ip=client_ip,
            before_state=before_state,
            after_state=after_state,
            message=message or f"Updated resource of type {event_type}",
            metadata_json=metadata_json
        )

    @classmethod
    def log_delete(
        cls,
        db: Session,
        user_id: Any,
        organization_id: Any,
        event_type: str,
        before_state: Dict[str, Any],
        client_ip: Optional[str] = None,
        message: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None,
    ) -> Optional[AuditLog]:
        return cls.log(
            db=db,
            event_type=event_type,
            status="SUCCESS",
            organization_id=organization_id,
            user_id=user_id,
            client_ip=client_ip,
            before_state=before_state,
            message=message or f"Deleted resource of type {event_type}",
            metadata_json=metadata_json
        )
