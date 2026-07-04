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
    Called by the frontend after signup/login to ensure the Supabase user
    is properly mirrored in the backend Postgres database. Auto-provisions missing profiles.
    """
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token payload")
        
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format")
        
    with _migration_lock:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            logger.info("Profile not found by ID. Checking by email under migration lock.")
            email = payload.get("email", "")
            user_metadata = payload.get("user_metadata", {})
            full_name = user_metadata.get("full_name", "")

            if email:
                try:
                    existing_profile = db.query(Profile).filter(Profile.email == email).with_for_update().first()
                except Exception:
                    existing_profile = db.query(Profile).filter(Profile.email == email).first()

                if existing_profile:
                    old_id = existing_profile.id
                    
                    profile = db.query(Profile).filter(Profile.id == user_id).first()
                    if profile:
                        return {"status": "synced", "user_id": profile.id}
                    
                    if old_id == user_id:
                        return {"status": "synced", "user_id": existing_profile.id}

                    logger.info(f"Found orphaned profile {old_id} for email {email}. Purging and creating fresh profile.")
                    try:
                        from app.services.account_service import AccountService
                        AccountService.purge_orphaned_profile(db, email)
                    except Exception as e:
                        logger.error(f"Failed to purge orphaned profile: {e}", exc_info=e)
                        db.rollback()
                    
                    try:
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        if profile:
                            return {"status": "synced", "user_id": profile.id}

                        profile = Profile(
                            id=user_id,
                            email=email,
                            full_name=full_name,
                            hashed_password="supabase-managed",
                            is_active=True
                        )
                        db.add(profile)
                        db.commit()
                        db.refresh(profile)
                        logger.info(f"Fresh profile provisioned after purge: {user_id}")
                    except Exception as e:
                        db.rollback()
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        if profile:
                            return {"status": "synced", "user_id": profile.id}
                        logger.error(f"Failed to provision fresh profile after purge: {e}", exc_info=e)
                        raise HTTPException(status_code=500, detail="Profile sync error")
                else:
                    logger.info(f"Auto-provisioning missing profile for user: {user_id}")
                    try:
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        if profile:
                            return {"status": "synced", "user_id": profile.id}

                        profile = Profile(
                            id=user_id,
                            email=email,
                            full_name=full_name,
                            hashed_password="supabase-managed",
                            is_active=True
                        )
                        db.add(profile)
                        db.commit()
                        db.refresh(profile)
                        logger.info(f"Profile provisioned successfully: {user_id}")
                    except Exception as e:
                        db.rollback()
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        if profile:
                            return {"status": "synced", "user_id": profile.id}
                        logger.error(f"Failed to auto-provision profile: {e}", exc_info=e)
                        raise HTTPException(status_code=500, detail="Database error during provisioning")
            else:
                raise HTTPException(status_code=400, detail="Email claim missing from token")
            
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
