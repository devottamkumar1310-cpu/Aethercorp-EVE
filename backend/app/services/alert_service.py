import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("eve.services.alert_service")


class AlertService:
    @staticmethod
    def _dispatch_alert(alert_type: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Dispatches alert messages. Emits structured log with 'alert=True'
        to trigger GCP Cloud Monitoring alerting rules.
        """
        extra_info = {
            "alert": True,
            "alert_type": alert_type
        }
        if metadata:
            extra_info.update(metadata)

        # Log alert with CRITICAL severity
        logger.critical(
            f"ALERT [{alert_type.upper()}]: {message}",
            extra=extra_info
        )

    @classmethod
    def alert_database_failure(cls, error_msg: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Trigger alert for database outages or connection pool exhaustion.
        """
        cls._dispatch_alert("database_failure", f"Database operation failed: {error_msg}", metadata)

    @classmethod
    def alert_ai_failure(cls, error_msg: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Trigger alert for Gemini API quota exhaustion or model timeout.
        """
        cls._dispatch_alert("ai_failure", f"AI COO / Extraction model processing failed: {error_msg}", metadata)

    @classmethod
    def alert_http_5xx(cls, error_msg: str, path: str, method: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Trigger alert for HTTP 500 / unhandled router exceptions.
        """
        meta = {
            "path": path,
            "method": method
        }
        if metadata:
            meta.update(metadata)
        cls._dispatch_alert("http_5xx", f"FastAPI route returned HTTP 500 at [{method}] {path}: {error_msg}", meta)
