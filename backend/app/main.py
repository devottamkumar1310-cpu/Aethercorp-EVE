# ==============================================================================CORSMiddleware
# PURPOSE: FastAPI Application Bootstrap Entrypoint.
# DATA FLOW: Initializes database -> sets up routes -> configures CORS -> runs Web server.
# EXTENSION POINTS: Add global exception handlers, rate limiters, or mount websocket gateways.
# ARCHITECTURAL DECISION:
# - Connects the database and configures CORS at startup to ensure immediate readiness.
# ==============================================================================

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.rate_limiter import rate_limit  # noqa: F401  # available for route-level Depends()

from app.config import settings
from app.database import init_db
from app.core.schema_validator import validate_schema, SchemaValidationError
from app.core.logging import setup_logging
from app.routes import inventory
from app.routes import chat
from app.routes import dashboard
# Import all self-registering services, memory layers, and managers
import app.models
import app.services.gemini_service
import app.services.analytics_service
import app.services.competitor_service
import app.services.report_service
import app.services.shopify_service
import app.services.supplier_service
import app.memory.embeddings
import app.memory.retrieval
import app.memory.short_term
import app.memory.long_term
import app.memory.memory_manager
import app.knowledge.knowledge_manager
# pyrefly: ignore [missing-import]
import app.artifacts.artifact_manager

logger = logging.getLogger("eve.main")

# Build allowed origins BEFORE the lifespan function is defined,
# so the startup log inside lifespan can reference this list without a NameError.
# Order matters: put more-specific origins first.
allowed_origins = [
    "https://aethercorp-eve.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",    # Swagger UI self-requests
    "http://127.0.0.1:8000",
]
if settings.FRONTEND_URL:
    for _origin in settings.FRONTEND_URL.split(","):
        _stripped = _origin.strip()
        if _stripped and _stripped not in allowed_origins:
            allowed_origins.append(_stripped)

logger.info(f"[CORS] Allowed origins at module load: {allowed_origins}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown lifecycle events.
    """
    # 1. Setup structured logging
    setup_logging(level="INFO")
    logger.info("Initializing EVE Platform services...")
    logger.info(f"[CORS] Allowed origins active: {allowed_origins}")

    # 2. Setup database schema structures
    try:
        init_db()
        logger.info("EVE Platform database initialized successfully.")
    except Exception as e:
        logger.critical(f"Failed to bootstrap database schemas: {e}", exc_info=e)
        raise

    # 3. Validate live database schema matches SQLAlchemy models.
    try:
        validate_schema()
    except SchemaValidationError:
        logger.critical(
            "Startup aborted: database schema mismatch detected. "
            "Run 'alembic upgrade head' against production before deploying."
        )
        raise

    yield
    logger.info("Shutting down EVE Platform services...")


# Initialize FastAPI app instance
app = FastAPI(
    title="EVE (Enterprise Virtual Executive) API Gateway",
    description="AI Operating System for D2C Fashion Brands.",
    version="1.0.0",
    lifespan=lifespan
)

# ──────────────────────────────────────────────────────────────────────────────
# MIDDLEWARE REGISTRATION ORDER NOTE
# Starlette processes middleware in REVERSE registration order.
# The LAST middleware added runs FIRST on incoming requests.
#
# Desired execution order (request in → response out):
#   SecurityHeadersMiddleware  →  CORSMiddleware  →  Router
#
# To achieve this, CORSMiddleware must be added LAST (it runs first).
# SecurityHeadersMiddleware must be added FIRST (it runs last, on the way out).
# ──────────────────────────────────────────────────────────────────────────────

# 1. Add SecurityHeadersMiddleware FIRST (executes LAST — on response out).
class SecurityHeadersMiddleware:
    """Injects standard security headers into every HTTP response.
    Skips OPTIONS (preflight) requests so CORS headers are not overwritten.
    Implemented as pure ASGI middleware to prevent disrupting FastAPI dependency teardown.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                if scope["method"] != "OPTIONS":
                    headers = message.get("headers", [])
                    # ASGI headers must be lowercased byte strings
                    headers.append((b"x-content-type-options", b"nosniff"))
                    headers.append((b"x-frame-options", b"DENY"))
                    headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                    headers.append((b"x-xss-protection", b"1; mode=block"))
                    message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


app.add_middleware(SecurityHeadersMiddleware)

# 2. Add CORSMiddleware LAST (executes FIRST — intercepts OPTIONS preflights
#    before any other middleware or router sees them).
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight for 10 minutes
)


# Global exception handlers for gateway error consistency
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import JSONResponse

def get_error_code(status_code: int) -> str:
    if status_code == 400:
        return "BAD_REQUEST"
    elif status_code == 401:
        return "UNAUTHORIZED"
    elif status_code == 402:
        return "PAYMENT_REQUIRED"
    elif status_code == 403:
        return "FORBIDDEN"
    elif status_code == 404:
        return "NOT_FOUND"
    elif status_code == 422:
        return "VALIDATION_ERROR"
    elif status_code == 429:
        return "RATE_LIMIT_EXCEEDED"
    elif status_code >= 500:
        return "INTERNAL_SERVER_ERROR"
    return "ERROR"

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        headers=getattr(exc, "headers", None),
        content={
            "status": "error",
            "message": exc.detail,
            "code": get_error_code(exc.status_code),
            "detail": exc.detail
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    msg = str(exc)
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "message": msg,
            "code": "VALIDATION_ERROR",
            "detail": msg
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"[GLOBAL UNHANDLED EXCEPTION] path={request.url.path} error={exc}", exc_info=exc)
    from app.services.alert_service import AlertService
    AlertService.alert_http_5xx(str(exc), request.url.path, request.method)
    msg = "An unexpected error occurred."
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": msg,
            "code": "INTERNAL_SERVER_ERROR",
            "detail": msg
        }
    )



app.include_router(inventory.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
from app.routes import auth, profile, organization, clients, projects, tasks, finance, analytics, activity, intelligence, executive, feedback, observability, document_intelligence, health, recommendation_trace, account
app.include_router(auth.router)
app.include_router(account.router)
app.include_router(health.router)
app.include_router(recommendation_trace.router)
app.include_router(document_intelligence.router)
app.include_router(profile.router)
app.include_router(organization.router)
app.include_router(clients.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(finance.router)
app.include_router(analytics.router)
app.include_router(activity.router)
app.include_router(intelligence.router)
app.include_router(executive.router)
app.include_router(feedback.router)
app.include_router(observability.router)


from sqlalchemy.orm import Session
from app.database import get_db

@app.get("/")
def read_root():
    """
    API Health check endpoint.
    """
    return {
        "status": "operational",
        "service": "EVE API Gateway",
        "environment": settings.ENV
    }

@app.get("/healthz")
def health_check(db: Session = Depends(get_db)):
    """
    Database-verified operational health check.
    """
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return {
            "status": "operational",
            "database": "connected",
            "service": "EVE API Gateway"
        }
    except Exception as e:
        logger.error(f"Health check database query failure: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "detail": "Failed to connect to the database"
            }
        )
