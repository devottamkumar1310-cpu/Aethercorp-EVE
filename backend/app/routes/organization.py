import re
import uuid as _uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import get_current_user, get_required_workspace_id, require_workspace_role
from app.models.profile import Profile
from app.models.organization import Organization, Membership

logger = logging.getLogger("eve.routes.organization")
router = APIRouter(prefix="/api/organization", tags=["organization"])

class OnboardRequest(BaseModel):
    name: str

@router.get("/workspaces")
def get_workspaces(current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    logger.info(f"[TRACE /api/organization/workspaces] STEP 1: Request received — user_id={current_user.id}")

    logger.info("[TRACE /api/organization/workspaces] STEP 2: Querying memberships")
    logger.info("DB query start")
    try:
        memberships = db.query(Membership).filter(Membership.user_id == current_user.id).all()
        logger.info(f"[TRACE /api/organization/workspaces] STEP 2a: Found {len(memberships)} membership(s)")
    except Exception as exc:
        logger.error(f"[TRACE /api/organization/workspaces] STEP 2 FAILED: {type(exc).__name__}: {exc}", exc_info=True)
        raise

    result = []
    for i, m in enumerate(memberships):
        logger.info(f"[TRACE /api/organization/workspaces] STEP 3.{i}: Resolving org_id={m.organization_id}")
        try:
            org = db.query(Organization).filter(Organization.id == m.organization_id).first()
            if org:
                logger.info(f"[TRACE /api/organization/workspaces] STEP 3.{i}a: Found org name={org.name!r} slug={org.slug!r}")
                member_count = db.query(Membership).filter(Membership.organization_id == org.id).count()
                result.append({
                    "id": str(org.id),
                    "name": org.name,
                    "slug": org.slug,
                    "role": m.role,
                    "member_count": member_count
                })
            else:
                logger.warning(f"[TRACE /api/organization/workspaces] STEP 3.{i}: Org not found for org_id={m.organization_id} — skipping orphaned membership")
        except Exception as exc:
            logger.error(f"[TRACE /api/organization/workspaces] STEP 3.{i} FAILED: {type(exc).__name__}: {exc}", exc_info=True)
            raise

    logger.info("DB query finish")
    logger.info(f"[TRACE /api/organization/workspaces] STEP 4: Returning {len(result)} workspace(s)")
    logger.info("END organization/workspaces")
    return result

@router.post("/onboard")
def onboard_workspace(request: OnboardRequest, current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if user already has a workspace with this name (idempotency check)
    existing_membership = db.query(Membership).join(Organization).filter(
        Membership.user_id == current_user.id,
        Organization.name == request.name
    ).first()
    
    if existing_membership:
        org = existing_membership.organization
        return {"status": "success", "organization_id": str(org.id), "slug": org.slug}

    # Generate slug from name
    slug = re.sub(r'[^a-z0-9]+', '-', request.name.lower()).strip('-')
    
    # Ensure slug uniqueness
    base_slug = slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create Organization
    org = Organization(name=request.name, slug=slug)
    db.add(org)
    db.flush() # To get org.id

    # Create Membership
    membership = Membership(
        user_id=current_user.id,
        organization_id=org.id,
        role="owner"
    )
    db.add(membership)
    try:
        db.commit()
        import logging
        logger = logging.getLogger("eve.organization")
        logger.info(f"Workspace '{org.name}' and Owner Membership created for user {current_user.id}")
    except Exception as e:
        db.rollback()
        import logging
        logger = logging.getLogger("eve.organization")
        logger.error(f"Failed to create workspace: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to create workspace")

    return {"status": "success", "organization_id": str(org.id), "slug": org.slug}

@router.post("/onboard-demo")
def onboard_demo(current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    name = "NovaWear Fashion"

    # Idempotency guard: return existing demo workspace if the user already owns one.
    # This prevents duplicate workspaces from double-click or concurrent POST requests.
    existing_membership = db.query(Membership).join(Organization).filter(
        Membership.user_id == current_user.id,
        Organization.name == name
    ).first()
    if existing_membership:
        org = existing_membership.organization
        logger.info(f"Returning existing demo workspace {org.id} for user {current_user.id}")
        return {"status": "success", "organization_id": str(org.id), "slug": org.slug}

    # Generate unique slug for demo workspace
    slug = "novawear-fashion"
    base_slug = slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create Organization
    org = Organization(name=name, slug=slug)
    db.add(org)
    db.flush() # To get org.id

    # Create Membership
    membership = Membership(
        user_id=current_user.id,
        organization_id=org.id,
        role="owner"
    )
    db.add(membership)
    db.commit()

    # Seed all demo workspace scenario data, sample documents, sample chats, recommendations
    from app.commands.seed_scenarios import seed_demo_workspace_data
    try:
        seed_demo_workspace_data(db, org.id)
    except Exception as e:
        import logging
        logger = logging.getLogger("eve.organization")
        logger.error(f"Seeding demo workspace data failed: {e}", exc_info=True)

    return {"status": "success", "organization_id": str(org.id), "slug": org.slug}



@router.delete("/{org_id}")
def delete_workspace(
    org_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a workspace. Only the workspace owner can perform this action."""
    import uuid as _uuid
    from app.services.account_service import AccountService
    try:
        workspace_uuid = _uuid.UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace ID format")

    success = AccountService.delete_workspace(db, workspace_uuid, current_user)
    if not success:
        raise HTTPException(status_code=403, detail="Only workspace owners can delete workspaces")

    return {"status": "success", "message": "Workspace and all associated data deleted successfully"}


class InviteRequest(BaseModel):
    email: str
    role: str


@router.post("/invite", status_code=status.HTTP_201_CREATED)
def invite_user(
    body: InviteRequest,
    db: Session = Depends(get_db),
    workspace_id: _uuid.UUID = Depends(get_required_workspace_id),
    current_membership: Membership = Depends(require_workspace_role("admin"))
):
    """
    Invite a user to the workspace. Requires Admin+ role.
    """
    # 1. Resolve or create user profile
    profile = db.query(Profile).filter(Profile.email == body.email).first()
    if not profile:
        profile = Profile(
            id=_uuid.uuid4(),
            email=body.email,
            full_name=body.email.split("@")[0].capitalize(),
            hashed_password="invited-temp-pw"
        )
        db.add(profile)
        db.flush()

    # 2. Check if already member
    existing = db.query(Membership).filter(
        Membership.organization_id == workspace_id,
        Membership.user_id == profile.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this workspace")

    # 3. Create Membership
    new_mem = Membership(
        organization_id=workspace_id,
        user_id=profile.id,
        role=body.role.lower()
    )
    db.add(new_mem)
    db.commit()
    return {"status": "success", "message": f"Invited {body.email} successfully as {body.role}"}


@router.delete("/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_user(
    user_id: _uuid.UUID,
    db: Session = Depends(get_db),
    workspace_id: _uuid.UUID = Depends(get_required_workspace_id),
    current_membership: Membership = Depends(require_workspace_role("admin"))
):
    """
    Remove a user from the workspace. Requires Admin+ role.
    Owner cannot be removed by Admin.
    """
    target_membership = db.query(Membership).filter(
        Membership.organization_id == workspace_id,
        Membership.user_id == user_id
    ).first()

    if not target_membership:
        raise HTTPException(status_code=404, detail="Membership not found in this workspace")

    # Guard: Owner cannot be removed by Admin
    if target_membership.role.lower() == "owner" and current_membership.role.lower() == "admin":
        raise HTTPException(status_code=403, detail="Owner cannot be removed by an Admin")

    db.delete(target_membership)
    db.commit()
    return {"status": "success", "message": "User removed successfully"}


@router.get("/storage-usage")
def get_storage_usage(
    db: Session = Depends(get_db),
    workspace_id: _uuid.UUID = Depends(get_required_workspace_id),
    _role = Depends(require_workspace_role("employee"))
):
    """
    Get organization-wide storage footprint and file metrics.
    """
    from app.services.document_intelligence.upload_security_service import UploadSecurityService
    return UploadSecurityService.get_storage_usage(db, workspace_id)


@router.post("/storage-cleanup")
def trigger_storage_cleanup(
    db: Session = Depends(get_db),
    _role = Depends(require_workspace_role("admin"))
):
    """
    Triggers cleanup of failed or orphaned files. Requires Admin+ role.
    """
    from app.services.document_intelligence.upload_security_service import UploadSecurityService
    return UploadSecurityService.cleanup_orphaned_uploads(db)



