import re
import uuid as _uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.core.scenario import scenario_for_demo
from app.database import get_db
from app.core.security import get_current_user, get_required_workspace_id, require_workspace_role
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.services.ai.proactive_analysis_service import ProactiveAnalysisService

logger = logging.getLogger("eve.routes.organization")
router = APIRouter(prefix="/api/organization", tags=["organization"])

class OnboardRequest(BaseModel):
    name: str

class DemoOnboardRequest(BaseModel):
    demo_company: str = "luma"

from sqlalchemy import func

@router.get("/workspaces")
def get_workspaces(current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    logger.info(f"[TRACE /api/organization/workspaces] STEP 1: Request received — user_id={current_user.id}")

    try:
        # Subquery for member counts per organization
        member_counts = (
            db.query(
                Membership.organization_id.label("org_id"),
                func.count(Membership.user_id).label("cnt")
            )
            .group_by(Membership.organization_id)
            .subquery()
        )

        rows = (
            db.query(Organization, Membership.role, func.coalesce(member_counts.c.cnt, 1).label("member_count"))
            .join(Membership, Membership.organization_id == Organization.id)
            .outerjoin(member_counts, member_counts.c.org_id == Organization.id)
            .filter(Membership.user_id == current_user.id)
            .all()
        )

        result = [
            {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "role": role,
                "member_count": int(member_count)
            }
            for org, role, member_count in rows
        ]

        if len(result) == 0:
            logger.info(f"[TRACE /api/organization/workspaces] User {current_user.id} has 0 workspaces. Auto-provisioning default workspace.")
            try:
                onboard_demo(DemoOnboardRequest(demo_company="luma"), background_tasks=BackgroundTasks(), current_user=current_user, db=db)
                rows = (
                    db.query(Organization, Membership.role, func.coalesce(member_counts.c.cnt, 1).label("member_count"))
                    .join(Membership, Membership.organization_id == Organization.id)
                    .outerjoin(member_counts, member_counts.c.org_id == Organization.id)
                    .filter(Membership.user_id == current_user.id)
                    .all()
                )
                result = [
                    {
                        "id": str(org.id),
                        "name": org.name,
                        "slug": org.slug,
                        "role": role,
                        "member_count": int(member_count)
                    }
                    for org, role, member_count in rows
                ]
            except Exception as auto_exc:
                logger.error(f"Auto-provisioning workspace in get_workspaces failed: {auto_exc}", exc_info=auto_exc)

        logger.info(f"[TRACE /api/organization/workspaces] STEP 4: Returning {len(result)} workspace(s)")
        return result
    except Exception as exc:
        logger.error(f"[TRACE /api/organization/workspaces] FAILED: {type(exc).__name__}: {exc}", exc_info=True)
        raise


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
def onboard_demo(request: DemoOnboardRequest, background_tasks: BackgroundTasks, current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    company_map = {
        "luma": ("Luma & Co.", "luma-and-co"),
        "drift": ("Drift Collective", "drift-collective"),
        "basecamp": ("Basecamp Basics", "basecamp-basics"),
    }
    demo_company = request.demo_company
    if demo_company not in company_map:
        demo_company = "luma"
        
    name, slug_base = company_map[demo_company]

    # Deterministic, per-user slug. The UNIQUE index on organizations.slug is the
    # DATABASE-LEVEL source of truth that guarantees a user can own at most one demo
    # organization per scenario — even under concurrent requests. Application checks
    # below are an optimization only; correctness does not depend on them.
    user_hex = _uuid.UUID(str(current_user.id)).hex[:12]
    slug = f"{slug_base}-{user_hex}"

    # Fast path (optimization, NOT the sole guarantee): if the user already owns this
    # demo — by deterministic slug, or by the legacy canonical name/slug for demos
    # provisioned before this scheme — return it without touching the write path.
    existing = (
        db.query(Organization)
        .join(Membership, Membership.organization_id == Organization.id)
        .filter(
            Membership.user_id == current_user.id,
            (Organization.slug == slug)
            | (Organization.slug == slug_base)
            | (Organization.name == name),
        )
        .first()
    )
    if existing:
        logger.info(f"Returning existing demo workspace {existing.id} for user {current_user.id}")
        return {"status": "success", "organization_id": str(existing.id), "slug": existing.slug}

    # Authoritative idempotent create: INSERT ... ON CONFLICT (slug) DO NOTHING.
    # Under simultaneous requests exactly one INSERT wins (RETURNING yields its id);
    # every other request no-ops (RETURNING is empty) — no duplicate org, slug, or name.
    new_org_id = _uuid.uuid4()
    insert_org = (
        pg_insert(Organization.__table__)
        .values(id=new_org_id, name=name, slug=slug, scenario_type=scenario_for_demo(demo_company))
        .on_conflict_do_nothing(index_elements=["slug"])
        .returning(Organization.__table__.c.id)
    )
    inserted_id = db.execute(insert_org).scalar()
    db.commit()
    created_here = inserted_id is not None

    # Resolve the org whether we created it or a concurrent request did.
    org = db.query(Organization).filter(Organization.slug == slug).first()
    if org is None:
        raise HTTPException(status_code=500, detail="Demo provisioning failed: organization missing after upsert.")

    # Idempotent owner membership: ON CONFLICT (organization_id, user_id) DO NOTHING,
    # backed by the uq_memberships_org_user unique constraint. Concurrent requests
    # cannot create duplicate ownership rows.
    insert_membership = (
        pg_insert(Membership.__table__)
        .values(id=_uuid.uuid4(), organization_id=org.id, user_id=current_user.id, role="owner")
        .on_conflict_do_nothing(index_elements=["organization_id", "user_id"])
    )
    db.execute(insert_membership)
    db.commit()

    # Seed ONLY on the request that actually created the org → no duplicate seed.
    if not created_here:
        logger.info(f"Concurrent onboard resolved to existing demo workspace {org.id} for user {current_user.id}")
        return {"status": "success", "organization_id": str(org.id), "slug": org.slug}

    # Seed all demo workspace scenario data, sample documents, sample chats, recommendations
    from app.commands.seed_scenarios import seed_demo_workspace_data
    from app.models.inventory import InventoryItem
    from app.models.recommendation_trace import RecommendationTrace

    try:
        seed_demo_workspace_data(db, org.id, demo_company)

        # Post-seed validation
        inventory_count = db.query(InventoryItem).filter(InventoryItem.organization_id == org.id).count()
        trace_count = db.query(RecommendationTrace).filter(RecommendationTrace.organization_id == org.id).count()

        if inventory_count == 0 or trace_count == 0:
            raise ValueError(f"Startup validation failed: Expected seeded artifacts but got Inventory: {inventory_count}, Traces: {trace_count}")

    except Exception as e:
        logger.error(f"Seeding demo workspace data failed: {e}", exc_info=True)
        # Roll back only the org we created (cascades membership + partial seed).
        db.delete(org)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize demo workspace properly. Creation rolled back. Error: {str(e)}"
        )

    # Note: We intentionally do NOT run ProactiveAnalysisService.generate_baseline_recommendations_async
    # here because seed_demo_workspace_data already pre-populates realistic RecommendationTraces.
    # Running the real analysis pipeline would block the asyncio event loop for 12+ seconds and
    # cause subsequent client requests (like layout.tsx workspaces fetch) to time out.

    return {"status": "success", "organization_id": str(org.id), "slug": org.slug}

@router.get("/{org_id}/analysis-status")
def get_analysis_status(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    return org.analysis_status or {"status": "none", "step": 0}

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



