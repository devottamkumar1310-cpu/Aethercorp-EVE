import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, description="Project name is required")
    description: Optional[str] = None
    budget: Optional[float] = Field(0.0, ge=0.0, description="Budget cannot be negative")
    status: Optional[str] = "planned"
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    completion_percentage: Optional[float] = Field(0.0, ge=0.0, le=100.0, description="Completion percentage must be between 0 and 100")
    estimated_hours: Optional[float] = Field(0.0, ge=0.0, description="Estimated hours cannot be negative")
    actual_hours: Optional[float] = Field(0.0, ge=0.0, description="Actual hours cannot be negative")

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
