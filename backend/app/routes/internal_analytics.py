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


def verify_owner_admin(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Profile:
    """
    Strict security dependency for internal owner analytics.
    Only allows designated owner emails or members with owner/admin privileges.
    Raises HTTP 403 Forbidden for non-admin users.
    """
    default_owners = "devottamkumar1310@gmail.com,devottamkumar1310-cpu@gmail.com,admin@aethercorp.com"
    allowed_emails_raw = os.environ.get("OWNER_ADMIN_EMAILS", default_owners)
    allowed_emails = [e.strip().lower() for e in allowed_emails_raw.split(",") if e.strip()]

    is_owner_email = current_user.email.lower() in allowed_emails

    has_admin_membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.role.in_(["owner", "admin"])
    ).first() is not None

    if not (is_owner_email or has_admin_membership):
        logger.warn(f"[SECURITY ALERT] Non-owner user {current_user.email} (id={current_user.id}) attempted to access /api/internal routes.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Owner/Admin privileges required."
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
