import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    budget: Optional[float] = 0.0
    status: Optional[str] = "planned"
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    completion_percentage: Optional[float] = 0.0
    estimated_hours: Optional[float] = 0.0
    actual_hours: Optional[float] = 0.0

class ProjectCreate(ProjectBase):
    client_id: uuid.UUID

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    completion_percentage: Optional[float] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

class ProjectResponse(ProjectBase):
    id: uuid.UUID
    client_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
