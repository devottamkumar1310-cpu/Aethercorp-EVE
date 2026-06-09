# ==============================================================================
# PURPOSE: Application Logging Configuration.
# DATA FLOW: Standardizes logs formatting across all modules, sending them to stdout.
# EXTENSION POINTS: Add file-rotation logging, send to external aggregation services
#                    like Datadog, ELK, Sentry, or Grafana Loki.
# ARCHITECTURAL DECISION:
# - Standardizes on a clean, console-friendly format that supports JSON-structured logging
#   or readable standard outputs.
# ==============================================================================

import logging
import sys


def setup_logging(level: str = "INFO"):
    """
    Sets up the global python logging handlers.
    Formats logs with timestamp, logger name, level, and message.
    """
    log_format = (
        "[%(asctime)s] %(levelname)-8s [%(name)s:%(filename)s:%(lineno)d] %(message)s"
    )
    
    # Configure root logger
    root_logger = logging.getLogger()
    
    # Clear existing handlers
    if root_logger.handlers:
        for handler in list(root_logger.handlers):
            root_logger.removeHandler(handler)
            
    # Set handler
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(log_format)
    handler.setFormatter(formatter)
    
    root_logger.addHandler(handler)
    
    # Parse logging level
    num_level = getattr(logging, level.upper(), logging.INFO)
    root_logger.setLevel(num_level)
    
    # Set third-party logger overrides
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("jose").setLevel(logging.WARNING)
    
    logging.getLogger("eve").info(f"Logging initialized at level: {level}")
