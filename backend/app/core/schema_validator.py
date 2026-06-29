# ==============================================================================
# PURPOSE: Startup schema validation guard.
# DATA FLOW: Called from lifespan() in main.py before the app accepts requests.
# RATIONALE: Detects model/database schema mismatches at deploy time so that
#            a misconfigured Cloud Run revision fails its health check and is
#            automatically rolled back — instead of silently serving 500 errors.
#
# HOW IT WORKS:
#   1. For every SQLAlchemy model registered on Base.metadata, retrieve the
#      actual column list from the live database via information_schema.
#   2. Compare the declared column names against the real ones.
#   3. On any mismatch, raise SchemaValidationError with a precise diff so the
#      Cloud Run log shows exactly what is missing.
#
# USAGE (in main.py lifespan):
#   from app.core.schema_validator import validate_schema
#   validate_schema()    # raises SchemaValidationError on mismatch → kills pod
# ==============================================================================

import logging
from typing import Dict, Set

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError, ProgrammingError

logger = logging.getLogger("eve.schema_validator")


class SchemaValidationError(RuntimeError):
    """Raised when the live database schema does not match the SQLAlchemy models."""


def get_declared_columns(metadata) -> Dict[str, Set[str]]:
    """
    Returns a mapping of table_name -> set of declared column names
    from SQLAlchemy's metadata (i.e., what the *code* expects).
    """
    declared: Dict[str, Set[str]] = {}
    for table_name, table in metadata.tables.items():
        declared[table_name] = {col.name for col in table.columns}
    return declared


def get_live_columns(engine) -> Dict[str, Set[str]]:
    """
    Returns a mapping of table_name -> set of actual column names
    from the live database (i.e., what *production* actually has).

    Uses SQLAlchemy's inspector, which works for both PostgreSQL and SQLite.
    """
    inspector = inspect(engine)
    live: Dict[str, Set[str]] = {}
    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        live[table_name] = {col["name"] for col in columns}
    return live


def validate_schema(engine=None, metadata=None) -> None:
    """
    Validates that the live database schema matches the SQLAlchemy model
    declarations. Raises SchemaValidationError on any mismatch.

    Args:
        engine:   SQLAlchemy Engine. Defaults to the app engine from database.py.
        metadata: SQLAlchemy MetaData. Defaults to Base.metadata.

    Raises:
        SchemaValidationError: If any model column is missing from the live DB.
    """
    # Lazy imports to avoid circular dependency at module load time
    if engine is None:
        from app.database import engine as _engine
        engine = _engine

    if metadata is None:
        from app.database import Base
        # Ensure all models are imported so metadata is fully populated
        import app.models  # noqa: F401
        metadata = Base.metadata

    logger.info("[SCHEMA VALIDATOR] Starting startup schema validation check...")

    try:
        declared = get_declared_columns(metadata)
        live = get_live_columns(engine)
    except (OperationalError, ProgrammingError) as exc:
        # Cannot reach database at all — let database.py handle this separately
        logger.warning(f"[SCHEMA VALIDATOR] Cannot connect to database for schema check: {exc}")
        return

    mismatches: list[str] = []
    missing_tables: list[str] = []

    for table_name, declared_cols in sorted(declared.items()):
        if table_name not in live:
            missing_tables.append(table_name)
            mismatches.append(
                f"  ✗ TABLE MISSING: '{table_name}' — entire table does not exist in the database"
            )
            continue

        live_cols = live[table_name]
        missing_cols = declared_cols - live_cols

        if missing_cols:
            for col in sorted(missing_cols):
                mismatches.append(
                    f"  ✗ COLUMN MISSING: '{table_name}.{col}' — declared in model but absent from database"
                )

    if mismatches:
        report = "\n".join(mismatches)
        error_message = (
            "\n"
            "╔══════════════════════════════════════════════════════════════════╗\n"
            "║        FATAL: DATABASE SCHEMA MISMATCH DETECTED AT STARTUP      ║\n"
            "╠══════════════════════════════════════════════════════════════════╣\n"
            "║  The deployed code expects columns that do not exist in the DB.  ║\n"
            "║  Run the pending Alembic migrations before starting the server.  ║\n"
            "║  Command: alembic upgrade head                                   ║\n"
            "╚══════════════════════════════════════════════════════════════════╝\n"
            f"\nSchema diff ({len(mismatches)} issue(s) found):\n{report}\n"
        )
        logger.critical(error_message)
        raise SchemaValidationError(error_message)

    logger.info(
        f"[SCHEMA VALIDATOR] ✓ Schema validation passed. "
        f"All {len(declared)} model tables are in sync with the database."
    )
