# ==============================================================================
# PURPOSE: Application Logging Configuration.
# DATA FLOW: Standardizes logs formatting across all modules, sending them to stdout.
# ==============================================================================

import json
import logging
import sys
import os


class JSONFormatter(logging.Formatter):
    """
    Serializes python log records into single-line JSON strings compatible
    with GCP Cloud Logging structured mapping formats.
    """
    def format(self, record: logging.LogRecord) -> str:
        # Severity mapping for GCP Stackdriver parsing
        severity_map = {
            "DEBUG": "DEBUG",
            "INFO": "INFO",
            "WARNING": "WARNING",
            "ERROR": "ERROR",
            "CRITICAL": "CRITICAL"
        }
        severity = severity_map.get(record.levelname, "INFO")

        log_payload = {
            "severity": severity,
            "message": record.getMessage(),
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%SZ"),
            "logger": record.name,
            "file": record.filename,
            "line": record.lineno
        }

        # Include exception tracebacks if present
        if record.exc_info:
            log_payload["exception"] = self.formatException(record.exc_info)

        # Populate context bindings if present
        for attr in ["trace_id", "organization_id", "user_id", "alert"]:
            if hasattr(record, attr):
                log_payload[attr] = getattr(record, attr)

        return json.dumps(log_payload)


def setup_logging(level: str = "INFO"):
    """
    Sets up the global python logging handlers.
    Outputs as structured JSON for production environments.
    """
    # Configure root logger
    root_logger = logging.getLogger()
    
    # Clear existing handlers
    if root_logger.handlers:
        for handler in list(root_logger.handlers):
            root_logger.removeHandler(handler)
            
    # Set handler
    handler = logging.StreamHandler(sys.stdout)
    
    # Enable JSON formatting in production or if explicitly configured
    use_json = (
        os.environ.get("JSON_LOGGING") == "True" or 
        os.environ.get("ENVIRONMENT") == "production" or
        os.environ.get("ENV") == "production"
    )

    if use_json:
        formatter = JSONFormatter()
    else:
        log_format = "[%(asctime)s] %(levelname)-8s [%(name)s:%(filename)s:%(lineno)d] %(message)s"
        formatter = logging.Formatter(log_format)

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    
    # Parse logging level
    num_level = getattr(logging, level.upper(), logging.INFO)
    root_logger.setLevel(num_level)
    
    # Set third-party logger overrides
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("jose").setLevel(logging.WARNING)
    
    logging.getLogger("eve").info(f"Logging initialized at level: {level} (Structured JSON: {use_json})")
