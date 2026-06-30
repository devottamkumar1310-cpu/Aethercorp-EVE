from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging
from supabase import create_client, Client

from app.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile
from app.models.organization import Membership
from app.config import settings

logger = logging.getLogger("eve.routes.account")
router = APIRouter(prefix="/api/account", tags=["account"])

@router.delete("/delete")
def delete_account(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id

    # 1. Check workspace ownership constraints
    user_memberships = db.query(Membership).filter(Membership.user_id == user_id).all()
    sole_owner_workspaces = []
    
    for membership in user_memberships:
        if membership.role == "owner":
            # Count total owners for this workspace
            owner_count = db.query(Membership).filter(
                Membership.organization_id == membership.organization_id,
                Membership.role == "owner"
            ).count()
            
            if owner_count == 1:
                sole_owner_workspaces.append(str(membership.organization_id))
    
    if sole_owner_workspaces:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are the sole owner of one or more workspaces. Please transfer ownership or delete the workspaces first."
        )

    # 2. Database Cleanup (Transaction)
    try:
        # Note: SQLAlchemy cascades on `Profile` will automatically delete `Membership`s
        db.delete(current_user)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database cleanup failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user database records."
        )

    # 3. Supabase Auth and Storage Cleanup
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            supabase_admin: Client = create_client(
                settings.SUPABASE_URL, 
                settings.SUPABASE_SERVICE_ROLE_KEY
            )
            
            # Delete Avatar from Storage (Optional, based on standard setup)
            try:
                supabase_admin.storage.from_("avatars").remove([f"{user_id}/avatar.png"])
            except Exception as storage_err:
                logger.warning(f"Failed to delete avatar for user {user_id}: {storage_err}")

            # Delete Supabase Auth User via Admin API
            supabase_admin.auth.admin.delete_user(str(user_id))
        except Exception as e:
            logger.error(f"Failed to delete Supabase Auth user {user_id}: {e}")
            # Non-fatal to the DB cleanup, but we should alert
            
    return {"message": "Account successfully deleted."}
