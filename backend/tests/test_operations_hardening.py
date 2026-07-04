# ==============================================================================
# PURPOSE: Integration tests for Phase 1 Operations Hardening features.
# DATA FLOW: Asserts structured JSON formatters, database fallback triggers,
#            GCP Secret Manager local bypassed defaults, and system health checks.
# ==============================================================================

import json
import logging
from fastapi.testclient import TestClient

from app.main import app
from app.services.gcp_secret_manager import GCPSecretManagerService
from app.services.alert_service import AlertService
from app.core.logging import JSONFormatter


def test_gcp_secret_manager_local_fallback():
    """
    Verifies that calling the Secret Manager without a GCP_PROJECT_ID env
    bypasses remote fetching and falls back to None (local configuration).
    """
    val = GCPSecretManagerService.get_secret("DATABASE_URL", project_id=None)
    assert val is None


def test_structured_json_formatter():
    """
    Verifies that the custom JSONFormatter produces compliant JSON lines with correct severity.
    """
    formatter = JSONFormatter()
    log_record = logging.LogRecord(
        name="test_logger",
        level=logging.ERROR,
        pathname="test_file.py",
        lineno=42,
        msg="Sample error telemetry log message",
        args=(),
        exc_info=None
    )
    
    formatted_str = formatter.format(log_record)
    log_json = json.loads(formatted_str)
    
    assert log_json["severity"] == "ERROR"
    assert log_json["message"] == "Sample error telemetry log message"
    assert log_json["logger"] == "test_logger"
    assert log_json["file"] == "test_file.py"
    assert log_json["line"] == 42


def test_alert_service_formatting(caplog):
    """
    Verifies that AlertService logs trigger critical alerts with extra fields.
    """
    caplog.clear()
    AlertService.alert_database_failure("Pool exhausted test error", {"test_key": "test_val"})
    
    # Verify log record has alert tag and critical severity
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.levelname == "CRITICAL"
    assert "Pool exhausted test error" in record.message
    assert getattr(record, "alert") is True
    assert getattr(record, "alert_type") == "database_failure"
    assert getattr(record, "test_key") == "test_val"



def test_health_check_endpoint():
    """
    Verifies the detailed health check API returns operational and system resource keys.
    """
    client = TestClient(app)
    resp = client.get("/api/health")
    
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "database" in data
    assert "storage" in data
    assert "system" in data
    assert "cpu_usage_percent" in data["system"]
    assert "memory_usage_percent" in data["system"]
