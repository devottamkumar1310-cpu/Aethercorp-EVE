# ==============================================================================
# PURPOSE: Database session and engine configuration.
# DATA FLOW: Creates connection pool to database, providing SQLAlchemy sessions to routes.
# EXTENSION POINTS: Add database migration hooks or custom connection pools (e.g., PgBouncer).
# ARCHITECTURAL DECISION:
# - Leverages standard SQLAlchemy Session factories.
# - Includes automatic SQLite fallback for testing environments where Postgres is not running.
# - Exposes a dependency injection generator function `get_db` for FastAPI routes.
# ==============================================================================

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger("eve.database")

# Setup connection options
database_url = settings.DATABASE_URL
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

engine_args = {}

# SQLite specific tuning parameters
if database_url.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

# Attempt connection to Postgres. If it fails, fallback to SQLite for local development.
Base = declarative_base()
engine = None
SessionLocal = None

try:
    from sqlalchemy.engine.url import make_url
    
    # 1. Log environment loading status by checking if it matches the default fallback
    is_default = (database_url == "postgresql://postgres:postgres@localhost:5432/eve")
    logger.info(f"[DB CONFIG] .env loaded custom DATABASE_URL: {not is_default}")
    
    # 2. Parse and log host and username safely
    parsed_url = make_url(database_url)
    logger.info(f"[DB CONFIG] Parsed Host: {parsed_url.host}")
    logger.info(f"[DB CONFIG] Parsed Username: {parsed_url.username}")
    
    engine = create_engine(database_url, **engine_args)
    # Test connection
    with engine.connect() as conn:
        logger.info("Database connection established successfully.")
except Exception as e:
    logger.error(f"Failed to connect to primary database: {e}")
    logger.warning("Falling back to local SQLite database 'eve_mvp.db'.")
    fallback_url = "sqlite:///eve_mvp.db"
    engine = create_engine(fallback_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency that provides a transactional database session.
    Automatically rolls back on exceptions and closes the session when done.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initializes database schemas. Creating tables if they do not exist.
    """
    try:
        # Import all models to ensure they are registered on Base.metadata
        from app.models.organization import Organization, Membership
        from app.models.profile import Profile
        from app.models.product import Product
        from app.models.supplier import Supplier
        from app.models.inventory import InventoryItem, SalesRecord
        from app.models.memory import ConversationSession, ChatMessage, MemoryEntry
        from app.models.artifact import Artifact
        from app.models.future import Forecast, Recommendation, Report
        
        # Check if pgvector is supported by the connection before building schemas
        if "postgresql" in engine.url.drivername:
            with engine.begin() as conn:
                from sqlalchemy import text
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                logger.info("PostgreSQL pgvector extension verified.")
        
        Base.metadata.create_all(bind=engine)
        logger.info("Database schemas initialized successfully.")
    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
        raise e
