from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
import logging

from app.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile
from app.models.organization import Organization, Membership

logger = logging.getLogger("eve.routes.account")
router = APIRouter(prefix="/api/account", tags=["account"])


@router.delete("/delete")
def delete_account(
    background_tasks: BackgroundTasks,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Permanently deletes the current user's account and all data in workspaces
    where they are the sole owner.

    Ownership constraint: if the user is the sole owner of any workspace with other active members,
    deletion is blocked with a 400 until they transfer ownership or remove members first.
    Delegates all cleanup (GCS files, Supabase Auth, DB records) to AccountService.
    """
    from app.services.account_service import AccountService

    user_id = current_user.id

    # 1. Check workspace ownership constraints before attempting deletion
    logger.info("[AUDIT-STAGE-START] Step 1: Ownership validation started")
    user_memberships = db.query(Membership).filter(Membership.user_id == user_id).all()
    blocked_workspaces = []

    for membership in user_memberships:
        if membership.role == "owner":
            owner_count = db.query(Membership).filter(
                Membership.organization_id == membership.organization_id,
                Membership.role == "owner"
            ).count()

            if owner_count == 1:
                # If they are the sole owner, check if there are other members
                total_member_count = db.query(Membership).filter(
                    Membership.organization_id == membership.organization_id
                ).count()

                if total_member_count > 1:
                    # Other members exist, block deletion until they transfer ownership
                    org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
                    org_name = org.name if org else "Workspace"
                    blocked_workspaces.append(f"{org_name} (ID: {membership.organization_id})")

    logger.info("[AUDIT-STAGE-COMPLETE] Step 1: Ownership validation completed")

    if blocked_workspaces:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Account deletion is unavailable because you are the sole owner of workspace(s) "
                f"with other active members: {', '.join(blocked_workspaces)}. "
                "Please transfer ownership or remove members first."
            )
        )

    # 2. Delegate full deletion (DB records, GCS files, Supabase Auth) to AccountService
    try:
        success = AccountService.delete_account(db, current_user, background_tasks)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Account deletion failed unexpectedly."
            )
    except ValueError as e:
        # SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not configured
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Account deletion failed for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during account deletion."
        )

    return {"status": "success", "message": "Account successfully deleted."}
