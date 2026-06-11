import uuid
import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional

class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    category: str = Field(..., description="Category of feedback (e.g. AI Response, UI Bug, Performance, Other)")
    description: str = Field(..., min_length=5, description="Detailed description of feedback")
    page_url: Optional[str] = Field(None, description="URL of the page where feedback was submitted")

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        allowed = ["AI Response", "UI Bug", "Performance", "Other"]
        if value not in allowed:
            raise ValueError(f"Category must be one of: {allowed}")
        return value

class FeedbackResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    organization_id: uuid.UUID
    rating: int
    category: str
    description: str
    page_url: Optional[str]
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }
