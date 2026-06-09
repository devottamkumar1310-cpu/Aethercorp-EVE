import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uuid

from app.database import get_db
from app.models.profile import Profile
from app.config import settings

security = HTTPBearer()

import logging

logger = logging.getLogger("eve.security")

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

def verify_supabase_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # Debug: Print unverified token to see what claims are present
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        logger.info(f"Unverified JWT Payload: {unverified_payload}")
        
        # 1. Attempt JWKS Asymmetric Verification (for ES256/RS256)
        if jwks_client:
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256", "HS256"],
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
        # Provide exact error details to the frontend to diagnose the issue
        import traceback
        tb = traceback.format_exc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"JWT Error ({type(e).__name__}): {str(e)}",
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
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        logger.info(f"Auto-provisioning missing profile for user: {user_id}")
        email = payload.get("email", "")
        # Get full name from user metadata if available
        user_metadata = payload.get("user_metadata", {})
        full_name = user_metadata.get("full_name", "")
        
        try:
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
            logger.error(f"Failed to auto-provision profile: {e}", exc_info=e)
            raise HTTPException(status_code=500, detail="Database error during provisioning")
            
    return profile

from app.models.organization import Membership

def get_current_user_and_tenant(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace found")
    return {"user_id": current_user.id, "organization_id": membership.organization_id}
