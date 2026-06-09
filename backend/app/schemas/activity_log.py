import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class ActivityLogBase(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    action: str
    description: Optional[str] = None

class ActivityLogCreate(ActivityLogBase):
    user_id: uuid.UUID

class ActivityLogResponse(ActivityLogBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
