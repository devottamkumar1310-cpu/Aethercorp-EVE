import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import threading
from app.database import get_db
from app.core.security import verify_supabase_token
from app.models.profile import Profile
from app.config import settings

logger = logging.getLogger("eve.routes.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


class ForgotPasswordRequest(BaseModel):
    email: str
    redirect_to: str


_migration_lock = threading.Lock()

@router.post("/sync")
def sync_user(
    payload: dict = Depends(verify_supabase_token),
    db: Session = Depends(get_db)
):
    """
    Idempotently ensures the Supabase user is mirrored in the database.
    Delegates directly to the centralized self-healing provisioner.
    """
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token payload")
        
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format")
        
    from app.core.security import _provision_profile_idempotent
    profile = _provision_profile_idempotent(db, user_id, payload)
    return {"status": "synced", "user_id": profile.id}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Triggers a password reset request safely.
    Follows anti-account-enumeration guidelines:
    - Queries EVE database internally to verify if account exists.
    - Sends recovery email via Supabase only if exists.
    - Always returns identical success message.
    """
    email_clean = body.email.strip().lower()
    profile = db.query(Profile).filter(Profile.email == email_clean).first()
    
    # Generic, non-revealing response message (industry standard)
    success_response = {
        "status": "success", 
        "message": "If an account exists for this email, a password reset link has been sent."
    }
    
    # If the user profile does not exist in our system, fail silently (do not send email, do not leak error)
    if not profile:
        logger.info(f"[FORGOT PASSWORD] Reset requested for non-existent email: {email_clean}")
        return success_response

    # Trigger recovery request on GoTrue auth API
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
                "Redirect-To": body.redirect_to
            }
            payload = {
                "email": email_clean
            }
            supabase_endpoint = f"{settings.SUPABASE_URL}/auth/v1/recover"
            response = await client.post(supabase_endpoint, json=payload, headers=headers)
            
            if response.status_code != 200:
                logger.error(
                    f"[FORGOT PASSWORD] GoTrue recover request failed for {email_clean}: "
                    f"status={response.status_code} response={response.text}"
                )
            else:
                logger.info(f"[FORGOT PASSWORD] Recovery email triggered successfully for {email_clean}")
    except Exception as e:
        logger.error(f"[FORGOT PASSWORD] Exception calling GoTrue recover API: {e}", exc_info=True)

    return success_response
