import uuid
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile
from app.services.document_intelligence.ingestion_service import IngestionService

logger = logging.getLogger("eve.routes.document_intelligence")

router = APIRouter(prefix="/api/documents", tags=["Document Intelligence"])

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    """
    Ingests and processes unstructured business documents (PDF, CSV, XLSX, PNG, JPG).
    Automatically extracts details, validates data quality, and updates business metrics.
    """
    try:
        result = await IngestionService.process_document(
            db=db,
            org_id=workspace_id,
            file=file
        )
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Uncaught exception during document ingestion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during document processing."
        )
