import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class RevenueBase(BaseModel):
    amount: float = Field(..., ge=0.0, description="Revenue amount cannot be negative")
    description: Optional[str] = None
    date: Optional[datetime] = None

class RevenueCreate(RevenueBase):
    project_id: uuid.UUID

class RevenueResponse(RevenueBase):
    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ExpenseBase(BaseModel):
    amount: float = Field(..., ge=0.0, description="Expense amount cannot be negative")
    category: str = Field(..., min_length=1, description="Category is required")
    description: Optional[str] = None
    date: Optional[datetime] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseResponse(ExpenseBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
