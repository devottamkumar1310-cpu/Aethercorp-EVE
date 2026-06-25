import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.activity_log import ActivityLogResponse
from app.services.activity_service import ActivityService
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile

router = APIRouter(prefix="/api/activity", tags=["Activity Logs"])

@router.get("/", response_model=List[ActivityLogResponse])
def get_activities(skip: int = 0, limit: int = 100, user_id: Optional[uuid.UUID] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return ActivityService.get_activities(db=db, workspace_id=workspace_id, skip=skip, limit=limit, user_id=user_id)

@router.get("/{activity_id}", response_model=ActivityLogResponse)
def get_activity(activity_id: uuid.UUID, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    activity = ActivityService.get_activity(db=db, activity_id=activity_id, workspace_id=workspace_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity log not found")
    return activity
