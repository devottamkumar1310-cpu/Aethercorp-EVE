from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile
from app.models.organization import Membership

router = APIRouter(prefix="/api/profile", tags=["profile"])

@router.get("/me")
def get_my_profile(current_user: Profile = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(Membership).filter(Membership.user_id == current_user.id).first()
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "organization_id": membership.organization_id if membership else None,
        "role": membership.role if membership else None
    }

@router.post("/sync")
def sync_profile(current_user: Profile = Depends(get_current_user)):
    return {
        "status": "synced",
        "id": current_user.id,
        "email": current_user.email
    }
