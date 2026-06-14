import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid
import threading

from app.database import get_db
from app.models.profile import Profile
from app.config import settings

security = HTTPBearer(auto_error=False)

import logging

logger = logging.getLogger("eve.security")

_migration_lock = threading.Lock()

# Initialize JWKS Client if URL is provided
jwks_client = None
if settings.SUPABASE_URL:
    try:
        from jwt import PyJWKClient
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        logger.info(f"Initialized PyJWKClient with URL: {jwks_url}")
    except ImportError:
        logger.warning("cryptography or PyJWKClient not available")

def verify_supabase_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        # Debug: Print unverified token to see what claims are present
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        logger.debug(f"Unverified JWT Payload: {unverified_payload}")
        
        # Get token header to check algorithm
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        
        # 1. Attempt JWKS Asymmetric Verification (for ES256/RS256)
        if alg in ["RS256", "ES256"] and jwks_client:
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256"],
                    audience="authenticated"
                )
                logger.info(f"JWT Validation Success (JWKS) for user: {payload.get('sub')}")
                return payload
            except Exception as e:
                logger.warning(f"JWKS validation failed, falling back to HS256: {e}")

        # 2. Attempt Symmetric HS256 Verification (Legacy/Default Supabase)
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
        except jwt.InvalidSignatureError:
            import base64
            # If signature validation fails, it's highly likely it requires base64 decoding
            decoded_secret = base64.b64decode(settings.SUPABASE_JWT_SECRET)
            payload = jwt.decode(
                token,
                decoded_secret,
                algorithms=["HS256"],
                audience="authenticated"
            )
            
        logger.info(f"JWT Validation Success (HS256) for user: {payload.get('sub')}")
        return payload
    except jwt.ExpiredSignatureError as e:
        logger.warning(f"JWT Validation Failed: Session expired - {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Session expired: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.warning(f"JWT Validation Failed: {type(e).__name__} - {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(
    payload: dict = Depends(verify_supabase_token),
    db: Session = Depends(get_db)
):
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token payload")
        
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format")
        
    # Auto-provision profile if it doesn't exist yet (synced from Supabase)
    with _migration_lock:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            logger.info(f"Profile not found by ID. Checking by email under migration lock.")
            email = payload.get("email", "")
            user_metadata = payload.get("user_metadata", {})
            full_name = user_metadata.get("full_name", "")

            # Check if profile with email exists
            if email:
                try:
                    # Lock row if supported to prevent concurrent migration attempts
                    existing_profile = db.query(Profile).filter(Profile.email == email).with_for_update().first()
                except Exception:
                    existing_profile = db.query(Profile).filter(Profile.email == email).first()

                if existing_profile:
                    old_id = existing_profile.id
                    
                    # Check if another concurrent request already migrated it
                    profile = db.query(Profile).filter(Profile.id == user_id).first()
                    if profile:
                        logger.info("Profile already migrated by concurrent request.")
                        return profile
                    
                    if old_id == user_id:
                        return existing_profile

                    logger.info(f"Migrating profile ID from {old_id} to {user_id} for email {email}")
                    try:
                        from sqlalchemy import text
                        from app.models.organization import Membership
                        from app.models.task import Task
                        from app.models.activity_log import ActivityLog
                        from sqlalchemy.exc import IntegrityError

                        # 1. Update the email of the old profile temporarily to free up the unique constraint
                        temp_email = f"migrated_{old_id}_{email}"
                        existing_profile.email = temp_email
                        db.flush()

                        # 2. Create the new profile record with the Supabase UUID
                        new_profile = Profile(
                            id=user_id,
                            email=email,
                            hashed_password=existing_profile.hashed_password,
                            full_name=full_name or existing_profile.full_name,
                            avatar_url=existing_profile.avatar_url,
                            is_active=existing_profile.is_active,
                            created_at=existing_profile.created_at
                        )
                        db.add(new_profile)
                        db.flush()

                        # 3. Re-point foreign keys
                        db.query(Membership).filter(Membership.user_id == old_id).update({Membership.user_id: user_id})
                        db.query(Task).filter(Task.assigned_to == old_id).update({Task.assigned_to: user_id})
                        db.query(ActivityLog).filter(ActivityLog.user_id == old_id).update({ActivityLog.user_id: user_id})
                        db.flush()

                        # 4. Delete the old profile
                        db.delete(existing_profile)
                        db.commit()

                        # 5. Expire ORM cache and reload the migrated profile
                        db.expire_all()
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        logger.info("Profile ID migration completed successfully.")
                    except Exception as e:
                        db.rollback()
                        logger.error(f"Failed to migrate profile ID: {e}", exc_info=e)
                        # Check if another thread completed it while we failed
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        if profile:
                            logger.info("Profile was successfully migrated by concurrent request despite error.")
                            return profile
                        raise HTTPException(status_code=500, detail="Profile sync error")
                else:
                    logger.info(f"Auto-provisioning missing profile for user: {user_id}")
                    try:
                        # Double check if another thread provisioned it concurrently
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        if profile:
                            logger.info("Profile already provisioned by concurrent request.")
                            return profile

                        profile = Profile(
                            id=user_id,
                            email=email,
                            full_name=full_name,
                            hashed_password="supabase-managed", # No longer needed but required by schema if not nullable
                            is_active=True
                        )
                        db.add(profile)
                        db.commit()
                        db.refresh(profile)
                        logger.info(f"Profile provisioned successfully: {user_id}")
                    except Exception as e:
                        db.rollback()
                        # Check again if it was created concurrently
                        profile = db.query(Profile).filter(Profile.id == user_id).first()
                        if profile:
                            logger.info("Profile was successfully provisioned concurrently despite error.")
                            return profile
                        logger.error(f"Failed to auto-provision profile: {e}", exc_info=e)
                        raise HTTPException(status_code=500, detail="Database error during provisioning")
            else:
                raise HTTPException(status_code=400, detail="Email claim missing from token")
            
    return profile


from fastapi import Header
from typing import Optional
from app.models.organization import Membership

def get_active_workspace_id(
    x_workspace_id: Optional[str] = Header(None),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Optional[uuid.UUID]:
    """
    Extracts and validates the active workspace from the X-Workspace-Id header.
    If header is missing, falls back to the user's first membership.
    If no workspaces exist, returns None.
    """
    if not x_workspace_id:
        membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
        return membership.organization_id if membership else None
        
    try:
        workspace_uuid = uuid.UUID(x_workspace_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace ID format")
        
    # Strict membership verification
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == workspace_uuid
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
        
    return workspace_uuid


def get_required_workspace_id(
    workspace_id: Optional[uuid.UUID] = Depends(get_active_workspace_id)
) -> uuid.UUID:
    """
    Validates that a workspace is active and returns its ID. Raises 400 if missing.
    """
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Active workspace is required for this operation")
    return workspace_id


def verify_workspace_admin(
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    db: Session = Depends(get_db)
) -> Membership:
    """
    Verifies that the current user has admin/owner privileges in the active workspace.
    """
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.organization_id == workspace_id
    ).first()
    
    if not membership or membership.role not in ["admin", "owner"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this workspace"
        )
    return membership


def get_current_user_and_tenant(
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    current_user: Profile = Depends(get_current_user)
):
    """
    Backwards compatible dependency returning standard tenant context.
    """
    return {"user_id": current_user.id, "organization_id": workspace_id}
