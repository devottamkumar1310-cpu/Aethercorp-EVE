import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.database import SessionLocal
from app.services.internal_analytics_service import InternalAnalyticsService

logger = logging.getLogger("eve.middleware.telemetry")


class InternalTelemetryMiddleware(BaseHTTPMiddleware):
    """
    Asynchronous, non-blocking telemetry middleware that records incoming request metrics
    to internal_analytics_events table.

    GUARANTEES:
    1. Measures real request latency after customer response is generated.
    2. Any failure inside telemetry logging is caught silently, NEVER affecting customer response.
    3. Excludes static assets and internal admin self-logging.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        
        # 1. Process customer request first
        response = await call_next(request)
        
        # 2. Calculate latency in milliseconds
        latency_ms = (time.time() - start_time) * 1000.0
        path = request.url.path

        # Ignore static assets, docs, and internal owner routes from self-telemetry
        if path.startswith("/_next") or path.startswith("/static") or path.startswith("/api/internal") or path == "/favicon.ico":
            return response

        # 3. Non-blocking telemetry event recording
        try:
            db = SessionLocal()
            try:
                # Classify event_type from endpoint path
                event_type = "api_request"
                if "/auth" in path:
                    event_type = "auth_event"
                elif "/documents" in path or "/upload" in path:
                    event_type = "csv_upload"
                elif "/executive" in path or "/intelligence" in path or "/chat" in path:
                    event_type = "ai_query"
                elif "/inventory" in path or "/analytics" in path or "/finance" in path:
                    event_type = "feature_access"

                if response.status_code >= 400:
                    event_type = "error"

                InternalAnalyticsService.log_event(
                    db=db,
                    event_type=event_type,
                    endpoint=path,
                    status_code=response.status_code,
                    latency_ms=round(latency_ms, 2),
                    metadata={"method": request.method}
                )
            finally:
                db.close()
        except Exception as e:
            # Silent failure guarantee: never interrupt or alter customer response
            logger.warning(f"Telemetry logging error (non-fatal): {e}")

        return response
