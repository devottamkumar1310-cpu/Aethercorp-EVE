import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile
from app.models.organization import Organization, Membership

router = APIRouter(prefix="/api/organization", tags=["organization"])

class OnboardRequest(BaseModel):
    name: str

@router.get("/workspaces")
def get_workspaces(current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(Membership).filter(Membership.user_id == current_user.id).all()
    result = []
    for m in memberships:
        org = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if org:
            result.append({
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "role": m.role
            })
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
