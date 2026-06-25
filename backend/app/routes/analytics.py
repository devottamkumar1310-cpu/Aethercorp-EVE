import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.business_analytics_service import BusinessAnalyticsService
from typing import Any
from app.core.security import get_current_user, get_required_workspace_id, verify_workspace_admin
from app.models.profile import Profile

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db), 
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return BusinessAnalyticsService.get_overview(db=db, organization_id=workspace_id)

@router.get("/products")
def get_product_analytics_endpoint(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    admin_check: Any = Depends(verify_workspace_admin)
):
    return BusinessAnalyticsService.get_product_analytics(db=db, organization_id=workspace_id)
