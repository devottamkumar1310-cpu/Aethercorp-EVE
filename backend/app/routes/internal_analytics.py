import os
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile
from app.models.organization import Membership
from app.services.internal_analytics_service import InternalAnalyticsService

logger = logging.getLogger("eve.routes.internal_analytics")

router = APIRouter(prefix="/api/internal", tags=["internal_analytics"])


from app.config import settings

def verify_owner_admin(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Profile:
    """
    Strict security dependency for internal owner analytics.
    Only allows the configured single owner account (default: devottamkumar1310@gmail.com).
    Raises HTTP 403 Forbidden for all non-owner users.
    Never relies on localStorage, cookies, client headers, or query params.
    """
    owner_email = (os.environ.get("OWNER_EMAIL") or settings.OWNER_EMAIL).strip().lower()

    if not current_user.email or current_user.email.strip().lower() != owner_email:
        logger.warning(f"[SECURITY ALERT] Unauthorized access attempt to /api/internal by user email '{current_user.email}' (id={current_user.id}). Required owner: '{owner_email}'.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Owner privileges required."
        )

    return current_user


@router.get("/overview")
def get_overview(
    admin: Profile = Depends(verify_owner_admin),
    db: Session = Depends(get_db)
):
    """
    Returns platform-wide growth, user, organization, and telemetry KPIs.
    Protected strictly by verify_owner_admin.
    """
    return InternalAnalyticsService.get_overview_metrics(db)


@router.get("/users")
def get_user_analytics(
    limit: int = Query(default=50, ge=1, le=500),
    admin: Profile = Depends(verify_owner_admin),
    db: Session = Depends(get_db)
):
    """
    Returns user signups and timeline data.
    Protected strictly by verify_owner_admin.
    """
    return InternalAnalyticsService.get_user_analytics(db, limit=limit)


@router.get("/feature-usage")
def get_feature_usage(
    admin: Profile = Depends(verify_owner_admin),
    db: Session = Depends(get_db)
):
    """
    Returns module usage and endpoint latency statistics.
    Protected strictly by verify_owner_admin.
    """
    return InternalAnalyticsService.get_feature_usage(db)


@router.get("/health")
def get_health(
    admin: Profile = Depends(verify_owner_admin),
    db: Session = Depends(get_db)
):
    """
    Returns system infrastructure health telemetry.
    Protected strictly by verify_owner_admin.
    """
    return InternalAnalyticsService.get_platform_health(db)


@router.get("/ai")
def get_ai_analytics(
    admin: Profile = Depends(verify_owner_admin),
    db: Session = Depends(get_db)
):
    """
    Returns AI conversation statistics, prompt counts, and recommendation acceptance rates.
    Protected strictly by verify_owner_admin.
    """
    return InternalAnalyticsService.get_ai_analytics(db)


@router.get("/alerts")
def get_alerts(
    admin: Profile = Depends(verify_owner_admin),
    db: Session = Depends(get_db)
):
    """
    Returns real-time system alert flags.
    Protected strictly by verify_owner_admin.
    """
    return InternalAnalyticsService.get_alerts(db)


@router.get("/events")
def get_recent_events(
    limit: int = Query(default=50, ge=1, le=200),
    admin: Profile = Depends(verify_owner_admin),
    db: Session = Depends(get_db)
):
    """
    Returns recent internal analytics events.
    Protected strictly by verify_owner_admin.
    """
    return InternalAnalyticsService.get_recent_events(db, limit=limit)
