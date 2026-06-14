import uuid
from typing import Optional
from datetime import datetime
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

class ClientBase(BaseModel):
    company_name: str = Field(..., min_length=1, description="Company name is required")
    contact_person: Optional[str] = None
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$", description="Must be a valid email format")
    phone: Optional[str] = None
    industry: Optional[str] = None
    status: Optional[str] = "lead"

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    status: Optional[str] = None

class ClientResponse(ClientBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
