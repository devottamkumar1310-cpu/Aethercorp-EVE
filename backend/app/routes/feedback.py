import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.models.feedback import FeedbackSubmission
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile
from app.models.activity_log import ActivityLog

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])

@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    try:
        feedback = FeedbackSubmission(
            user_id=current_user.id,
            organization_id=workspace_id,
            rating=body.rating,
            category=body.category,
            description=body.description,
            page_url=body.page_url
        )
        db.add(feedback)
        db.flush()

        # Log activity
        activity = ActivityLog(
            user_id=current_user.id,
            organization_id=workspace_id,
            entity_type="Feedback",
            entity_id=feedback.id,
            action="Submit Feedback",
            description=f"Submitted a {body.rating}-star feedback in category '{body.category}'."
        )
        db.add(activity)
        db.commit()
        db.refresh(feedback)
        
        return feedback
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit feedback: {str(e)}"
        )

@router.get("/", response_model=List[FeedbackResponse])
def list_feedback(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    # Only return feedback for the active workspace (or restrict to admins if profile had roles)
    return db.query(FeedbackSubmission).filter(FeedbackSubmission.organization_id == workspace_id).order_by(FeedbackSubmission.created_at.desc()).all()
