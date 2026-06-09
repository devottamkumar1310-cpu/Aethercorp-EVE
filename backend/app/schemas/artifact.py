# ==============================================================================
# PURPOSE: Pydantic schemas for generated decision Artifacts.
# DATA FLOW: Read from DB, validated, and serialized to JSON for client consumption.
# EXTENSION POINTS: Add export configuration schemas (PDF, Excel) or user approval flags.
# ARCHITECTURAL DECISION:
# - Matches the columns in the database model to serialize records cleanly.
# ==============================================================================

from typing import Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ArtifactSchema(BaseModel):
    """
    Structured envelope representing a compiled executive report or agent calculation sheet.
    """
    id: int = Field(..., description="Database record identifier")
    organization_id: int = Field(..., description="Owner organization ID")
    artifact_type: str = Field(..., description="Report type (e.g. inventory_report, pricing_report, executive_report)")
    title: str = Field(..., description="Display title of the report")
    structured_content: Dict[str, Any] = Field(..., description="Internal JSON payload containing tables and charts data")
    version: int = Field(default=1, description="Revision version")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last updated timestamp")

    class Config:
        from_attributes = True
