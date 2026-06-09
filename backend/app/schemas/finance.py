import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class RevenueBase(BaseModel):
    amount: float
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
    amount: float
    category: str
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
