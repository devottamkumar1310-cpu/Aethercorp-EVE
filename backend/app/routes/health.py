import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

router = APIRouter(prefix="/api/health", tags=["System Health"])


@router.get("")
def check_system_health(db: Session = Depends(get_db)):
    """
    Detailed system health endpoint verifying database, storage, and CPU/Memory usage.
    """
    # 1. Check database connectivity
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "unhealthy"
        from app.services.alert_service import AlertService
        AlertService.alert_database_failure(f"Health check query failed: {str(e)}")

    # 2. Check storage write capabilities
    storage_status = "healthy"
    temp_file = "uploads/health_check_temp.txt"
    try:
        os.makedirs("uploads", exist_ok=True)
        with open(temp_file, "w") as f:
            f.write("health check")
        os.remove(temp_file)
    except Exception:
        storage_status = "unhealthy"

    # 3. Check resources using psutil safely
    cpu_usage = 0.0
    memory_usage = 0.0
    disk_usage = 0.0
    try:
        import psutil
        cpu_usage = psutil.cpu_percent(interval=None) or 0.0
        memory_usage = psutil.virtual_memory().percent or 0.0
        disk_usage = psutil.disk_usage(".").percent or 0.0
    except Exception:
        pass

    overall_status = "healthy" if (db_status == "healthy" and storage_status == "healthy") else "unhealthy"

    return {
        "status": overall_status,
        "database": db_status,
        "storage": storage_status,
        "system": {
            "cpu_usage_percent": cpu_usage,
            "memory_usage_percent": memory_usage,
            "disk_usage_percent": disk_usage
        }
    }
