import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.finance import RevenueCreate, RevenueResponse, ExpenseCreate, ExpenseResponse
from app.services.finance_service import FinanceService
from app.core.security import get_current_user
from app.models.profile import Profile

router = APIRouter(prefix="/finance", tags=["Finance"])

@router.post("/revenue", response_model=RevenueResponse, status_code=status.HTTP_201_CREATED)
def create_revenue(revenue: RevenueCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    return FinanceService.create_revenue(db=db, revenue=revenue, user_id=current_user.id)

@router.get("/revenue", response_model=List[RevenueResponse])
def get_revenues(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    return FinanceService.get_revenues(db=db, skip=skip, limit=limit)

@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    return FinanceService.create_expense(db=db, expense=expense, user_id=current_user.id)

@router.get("/expenses", response_model=List[ExpenseResponse])
def get_expenses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    return FinanceService.get_expenses(db=db, skip=skip, limit=limit)
