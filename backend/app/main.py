# ==============================================================================CORSMiddleware
# PURPOSE: FastAPI Application Bootstrap Entrypoint.
# DATA FLOW: Initializes database -> sets up routes -> configures CORS -> runs Web server.
# EXTENSION POINTS: Add global exception handlers, rate limiters, or mount websocket gateways.
# ARCHITECTURAL DECISION:
# - Connects the database and configures CORS at startup to ensure immediate readiness.
# ==============================================================================

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(inventory.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
from app.routes import auth, profile, organization
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(organization.router)


@app.get("/")
def read_root():
    """
    API Health check endpoint.
    """
    return {
        "status": "operational",
        "service": "EVE API Gateway",
        "environment": settings.ENV,
        "database": "connected"
    }
