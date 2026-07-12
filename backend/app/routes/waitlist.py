import datetime
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.waitlist import WaitlistEntry
from app.models.profile import Profile
from app.core.security import security, verify_supabase_token, verify_workspace_admin
from fastapi.security import HTTPAuthorizationCredentials

logger = logging.getLogger("eve.waitlist")
router = APIRouter(prefix="/api/waitlist", tags=["Waitlist & Trial System"])


class WaitlistJoinRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    revenue_range: Optional[str] = None
    biggest_inventory_challenge: Optional[str] = None


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Profile]:
    """
    Dependency to resolve the current user if authenticated,
    without raising an HTTP 401 on failure/absence.
    """
    if credentials is None:
        return None
    try:
        payload = verify_supabase_token(request, credentials)
        user_id_str = payload.get("sub")
        if user_id_str:
            user_id = uuid.UUID(user_id_str)
            return db.query(Profile).filter(Profile.id == user_id).first()
    except Exception as e:
        logger.debug(f"Optional token resolution failed: {e}")
    return None


@router.post("")
def join_waitlist(
    body: WaitlistJoinRequest,
    db: Session = Depends(get_db),
    current_user: Optional[Profile] = Depends(get_current_user_optional)
):
    """
    Register a user or lead on the priority waitlist.
    """
    user_id = current_user.id if current_user else None
    email = body.email or (current_user.email if current_user else None)
    name = body.name or (current_user.full_name if current_user else None)

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required to join the waitlist."
        )

    # Prevent duplicate entries for the same email
    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == email).first()
    if existing:
        return {"status": "already_registered", "message": "You are already on the priority waitlist!"}

    entry = WaitlistEntry(
        user_id=user_id,
        name=name,
        email=email,
        company_name=body.company_name,
        company_website=body.company_website,
        revenue_range=body.revenue_range,
        biggest_inventory_challenge=body.biggest_inventory_challenge
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Also log an activity log if user is logged in
    if current_user:
        try:
            from app.models.activity_log import ActivityLog
            from app.models.organization import Membership
            membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
            if membership:
                log = ActivityLog(
                    workspace_id=membership.organization_id,
                    entity_type="User",
                    action="JOIN_WAITLIST",
                    description=f"User {email} joined the priority launch waitlist."
                )
                db.add(log)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to record waitlist activity log: {e}")

    return {"status": "success", "message": "Successfully joined the priority waitlist!"}


@router.get("/admin-stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    _admin = Depends(verify_workspace_admin),
):
    """
    Operational analytics for admin visibility.
    """
    now = datetime.datetime.utcnow()

    # Trials statistics
    total_trials = db.query(Profile).filter(Profile.subscription_status == "trial").count()
    active_trials = db.query(Profile).filter(
        Profile.subscription_status == "trial",
        Profile.trial_end_date > now
    ).count()
    expired_trials = db.query(Profile).filter(
        Profile.subscription_status == "trial",
        Profile.trial_end_date <= now
    ).count()

    # Waitlist statistics
    waitlist_count = db.query(WaitlistEntry).count()

    return {
        "trials": {
            "total": total_trials,
            "active": active_trials,
            "expired": expired_trials
        },
        "waitlist": {
            "total_signups": waitlist_count
        }
    }
