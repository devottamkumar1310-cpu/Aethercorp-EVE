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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown lifecycle events.
    """
    # 1. Setup structured logging
    setup_logging(level="INFO")
    logger.info("Initializing EVE Platform services...")

    # 2. Setup database schema structures
    try:
        init_db()
        logger.info("EVE Platform database initialized successfully.")
    except Exception as e:
        logger.critical(f"Failed to bootstrap database schemas: {e}", exc_info=e)

    yield
    logger.info("Shutting down EVE Platform services...")


# Initialize FastAPI app instance
app = FastAPI(
    title="EVE (Enterprise Virtual Executive) API Gateway",
    description="AI Operating System for D2C Fashion Brands.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for Next.js frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        settings.FRONTEND_URL
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security headers middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects standard security headers into every HTTP response."""
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


app.add_middleware(SecurityHeadersMiddleware)


# Global exception handler to prevent leaking internal stack traces / details
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # If it's already an HTTPException, let it bubble up to be handled by FastAPI's default handlers
    if isinstance(exc, HTTPException):
        raise exc
    logger.error(f"[GLOBAL UNHANDLED EXCEPTION] path={request.url.path} error={exc}", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred."}
    )


app.include_router(inventory.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
from app.routes import auth, profile, organization, clients, projects, tasks, finance, analytics, activity, intelligence, executive, feedback
app.include_router(auth.router)
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
