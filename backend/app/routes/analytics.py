from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.business_analytics_service import BusinessAnalyticsService
from app.core.security import get_current_user
from app.models.profile import Profile

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview")
def get_analytics_overview(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    return BusinessAnalyticsService.get_overview(db=db)
