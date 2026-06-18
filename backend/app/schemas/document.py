from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, Union


class ProcessedDocumentResponse(BaseModel):
    id: UUID
    filename: str
    content_type: str
    file_size: int
    status: str
    document_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    created_at: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class ProcessedDocumentDetailResponse(ProcessedDocumentResponse):
    extracted_data: Optional[Dict[str, Any]] = None
    quality_assessment: Optional[Dict[str, Any]] = None
    coo_insights: Optional[Union[Dict[str, Any], str]] = None

    class Config:
        from_attributes = True
