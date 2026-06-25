import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.finance import RevenueCreate, RevenueResponse, ExpenseCreate, ExpenseResponse
from app.services.finance_service import FinanceService
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile

router = APIRouter(prefix="/api/finance", tags=["Finance"])

@router.post("/revenue", response_model=RevenueResponse, status_code=status.HTTP_201_CREATED)
def create_revenue(revenue: RevenueCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    try:
        return FinanceService.create_revenue(db=db, revenue=revenue, user_id=current_user.id, workspace_id=workspace_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/revenue", response_model=List[RevenueResponse])
def get_revenues(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return FinanceService.get_revenues(db=db, workspace_id=workspace_id, skip=skip, limit=limit)

@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return FinanceService.create_expense(db=db, expense=expense, user_id=current_user.id, workspace_id=workspace_id)

@router.get("/expenses", response_model=List[ExpenseResponse])
def get_expenses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return FinanceService.get_expenses(db=db, workspace_id=workspace_id, skip=skip, limit=limit)
