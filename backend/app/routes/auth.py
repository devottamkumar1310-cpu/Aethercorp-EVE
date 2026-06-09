from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import get_current_user
from app.models.profile import Profile

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/sync")
def sync_user(current_user: Profile = Depends(get_current_user)):
    """
    Called by the frontend after signup/login to ensure the Supabase user
    is properly mirrored in the backend Postgres database.
    """
    return {"status": "synced", "user_id": current_user.id}
