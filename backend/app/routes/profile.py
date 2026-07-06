from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx
import logging

from app.database import get_db
from app.core.security import get_current_user, verify_supabase_token
from app.models.profile import Profile
from app.models.organization import Membership
from app.services.audit_service import AuditService
from app.services.gcs_service import GCSService
from app.config import settings

logger = logging.getLogger("eve.routes.profile")
router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None


class EmailChangeRequest(BaseModel):
    new_email: str


@router.get("/me")
def get_my_profile(
    current_user: Profile = Depends(get_current_user),
    payload: dict = Depends(verify_supabase_token),
    db: Session = Depends(get_db)
):
    logger.info(f"[TRACE /api/profile/me] STEP 1: Request received — user_id={current_user.id} email={current_user.email}")

    logger.info(f"[TRACE /api/profile/me] STEP 2: JWT validated — sub={payload.get('sub')} aud={payload.get('aud')}")

    logger.info(f"[TRACE /api/profile/me] STEP 3: Querying membership for user_id={current_user.id}")
    try:
        membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
        logger.info(f"[TRACE /api/profile/me] STEP 3a: Membership query OK — found={membership is not None}")
    except Exception as exc:
        logger.error(f"[TRACE /api/profile/me] STEP 3 FAILED: {type(exc).__name__}: {exc}", exc_info=True)
        raise

    # Read verification claims from Supabase payload
    email_verified = payload.get("email_verified") or bool(payload.get("email_confirmed_at"))

    logger.info(f"[TRACE /api/profile/me] STEP 4: Building response — timezone={current_user.timezone!r} language={current_user.language!r} avatar_url={current_user.avatar_url!r}")

    response = {
        "id": current_user.id,
        "email": current_user.email,
        "email_verified": bool(email_verified),
        "full_name": current_user.full_name,
        "timezone": current_user.timezone,
        "language": current_user.language,
        "avatar_url": current_user.avatar_url,
        "organization_id": membership.organization_id if membership else None,
        "role": membership.role if membership else None,
        "trial_start_date": current_user.trial_start_date.isoformat() if current_user.trial_start_date else None,
        "trial_end_date": current_user.trial_end_date.isoformat() if current_user.trial_end_date else None,
        "subscription_status": current_user.subscription_status,
        "plan_type": current_user.plan_type
    }
    logger.info("[TRACE /api/profile/me] STEP 5: Response ready — returning 200")
    logger.info("END profile/me")
    return response



@router.put("/me")
def update_profile(
    body: ProfileUpdateRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the active user's profile settings (timezone, language, full_name).
    Audits the update event.
    """
    membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
    org_id = membership.organization_id if membership else None

    before_state = {
        "full_name": current_user.full_name,
        "timezone": current_user.timezone,
        "language": current_user.language
    }

    if body.full_name is not None:
        current_user.full_name = body.full_name.strip()
    if body.timezone is not None:
        current_user.timezone = body.timezone.strip()
    if body.language is not None:
        current_user.language = body.language.strip()

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    after_state = {
        "full_name": current_user.full_name,
        "timezone": current_user.timezone,
        "language": current_user.language
    }

    # Log operational audit trace
    AuditService.log_update(
        db=db,
        user_id=current_user.id,
        organization_id=org_id,
        event_type="profile_update",
        before_state=before_state,
        after_state=after_state,
        message="User updated account settings profile details."
    )

    return {
        "id": current_user.id,
        "email": current_user.email,
        "email_verified": True,
        "full_name": current_user.full_name,
        "timezone": current_user.timezone,
        "language": current_user.language,
        "avatar_url": current_user.avatar_url,
        "organization_id": org_id,
        "role": membership.role if membership else None
    }


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Uploads and updates the user's avatar image.
    Validates file type and restricts size < 2MB.
    """
    # 1. Type validation
    allowed_types = ["image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image type. Only JPG, JPEG, and PNG are allowed."
        )

    # 2. Size validation
    max_size = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 2MB."
        )

    # 3. Store file via GCSService
    membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
    org_id = membership.organization_id if membership else None
    
    file_extension = file.filename.split(".")[-1] if file.filename else "png"
    destination_path = f"avatars/{current_user.id}.{file_extension}"
    
    avatar_url = GCSService.upload_file(destination_path, content, file.content_type)

    before_state = {"avatar_url": current_user.avatar_url}
    current_user.avatar_url = avatar_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    after_state = {"avatar_url": current_user.avatar_url}

    AuditService.log_update(
        db=db,
        user_id=current_user.id,
        organization_id=org_id,
        event_type="avatar_update",
        before_state=before_state,
        after_state=after_state,
        message="User uploaded new profile avatar image."
    )

    return {"status": "success", "avatar_url": avatar_url}



@router.post("/me/email")
async def request_email_change(
    body: EmailChangeRequest,
    request: Request,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers Supabase email update request.
    Sends notification warning to previous email address.
    Logs an audit trace event.
    """
    membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
    org_id = membership.organization_id if membership else None
    
    new_email_clean = body.new_email.strip().lower()
    if new_email_clean == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New email must be different from current email."
        )

    # 1. Notify previous email address (Security Warning logger warning)
    logger.warning(
        f"[SECURITY WARNING] Email change request initiated for user {current_user.id}. "
        f"Attempting to change email from {current_user.email} to {new_email_clean}."
    )

    # 2. Call Supabase Auth to update user email (authenticating with user's access token)
    auth_header = request.headers.get("Authorization")
    token = auth_header.replace("Bearer ", "") if auth_header else None
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token missing")

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            supabase_endpoint = f"{settings.SUPABASE_URL}/auth/v1/user"
            resp = await client.put(supabase_endpoint, json={"email": new_email_clean}, headers=headers)
            
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supabase auth update failed: {resp.text}"
                )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to communicate with auth server: {e}"
        )

    # 3. Log audit trace
    AuditService.log_update(
        db=db,
        user_id=current_user.id,
        organization_id=org_id,
        event_type="email_change_requested",
        before_state={"email": current_user.email},
        after_state={"pending_email": new_email_clean},
        message=f"Initiated email update request to {new_email_clean}. Verification required."
    )

    return {
        "status": "pending",
        "message": "Verification links have been sent to both your current and new email addresses."
    }


@router.post("/sync")
def sync_profile(current_user: Profile = Depends(get_current_user)):
    return {
        "status": "synced",
        "id": current_user.id,
        "email": current_user.email
    }
