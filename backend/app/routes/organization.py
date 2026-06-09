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

@router.post("/onboard")
def onboard_workspace(request: OnboardRequest, current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if user already has a membership
    existing_membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
    if existing_membership:
        raise HTTPException(status_code=400, detail="User already belongs to a workspace")

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
