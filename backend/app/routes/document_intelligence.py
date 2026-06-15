import os
import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.services.gcs_service import GCSService

from app.database import get_db, SessionLocal
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile
from app.models.document import ProcessedDocument
from app.schemas.document import ProcessedDocumentResponse, ProcessedDocumentDetailResponse

logger = logging.getLogger("eve.routes.document_intelligence")

router = APIRouter(prefix="/api/documents", tags=["Document Intelligence"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def process_document_in_background(doc_id: uuid.UUID, org_id: uuid.UUID, file_bytes: bytes, filename: str, content_type: str):
    from app.services.document_intelligence.document_classifier import DocumentClassifier
    from app.services.document_intelligence.extraction_engine import ExtractionEngine
    from app.services.document_intelligence.validation_engine import ValidationEngine
    from app.services.document_intelligence.ingestion_service import IngestionService
    from app.services.audit_logger import AuditLogger

    db = SessionLocal()
    try:
        # Fetch document
        doc = db.query(ProcessedDocument).filter(ProcessedDocument.id == doc_id).first()
        if not doc:
            return

        # Transition to processing stage
        doc.status = "processing"
        db.commit()

        # Run Classification
        classification = await DocumentClassifier.classify_document(
            db=db,
            file_content=file_bytes,
            filename=filename,
            mime_type=content_type
        )

        if classification.document_type == "Unknown" or classification.confidence < 0.8:
            raise Exception(
                f"Unable to classify document with high confidence (Got: '{classification.document_type}', confidence: {classification.confidence:.2f})."
            )

        # Transition to classified stage
        doc.status = "classified"
        doc.document_type = classification.document_type
        doc.classification_confidence = classification.confidence
        db.commit()

        # Run Extraction
        extracted_data = await ExtractionEngine.extract_details(
            file_content=file_bytes,
            mime_type=content_type,
            document_type=classification.document_type,
            filename=filename
        )

        # Run Validation
        validation = ValidationEngine.validate_extraction(
            db=db,
            org_id=org_id,
            extraction_result=extracted_data
        )

        if validation.quality_score < 50.0:
            raise Exception(
                f"Critical validation issues detected. Quality score: {validation.quality_score:.1f}."
            )

        # Transition to validated stage
        doc.status = "validated"
        doc.extracted_data = extracted_data.model_dump()
        doc.quality_assessment = validation.model_dump()
        db.commit()

        # Integrate operational data
        IngestionService._integrate_data(db, org_id, classification.document_type, extracted_data)

        # Generate COO Insights
        coo_insights = await IngestionService._generate_coo_insights(
            db,
            org_id,
            classification.document_type,
            extracted_data,
            validation
        )

        # Transition to completed stage
        doc.status = "completed"
        doc.coo_insights = coo_insights
        db.commit()

        AuditLogger.log(
            db, "document_ingestion", "success", org_id,
            f"Asynchronously processed {classification.document_type} from file: {filename}"
        )
    except Exception as e:
        db.rollback()
        # Retrieve document again
        doc = db.query(ProcessedDocument).filter(ProcessedDocument.id == doc_id).first()
        if doc:
            doc.status = "failure"
            doc.error_message = str(e)
            db.commit()

        from app.services.audit_logger import AuditLogger
        AuditLogger.log(
            db, "document_ingestion", "failure", org_id,
            f"Background processing failed for file: {filename}. Error: {str(e)}"
        )
    finally:
        db.close()


@router.post("/upload", status_code=status.HTTP_201_CREATED, response_model=ProcessedDocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    filename = file.filename
    content_type = file.content_type

    # Validate file size (10 MB limit)
    file_bytes = await file.read()
    file_size = len(file_bytes)
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 10MB limit."
        )

    # Validate extensions
    allowed_extensions = {".pdf", ".csv", ".xlsx", ".png", ".jpg", ".jpeg"}
    file_ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file format '{file_ext}'."
        )

    # Create processed document record in DB
    doc_id = uuid.uuid4()
    file_ext_clean = file_ext.replace(".", "")
    gcs_filename = f"{doc_id}.{file_ext_clean}"

    # Upload using GCSService (GCS with local fallback)
    file_path = GCSService.upload_file(gcs_filename, file_bytes, content_type)

    processed_doc = ProcessedDocument(
        id=doc_id,
        organization_id=workspace_id,
        filename=filename,
        content_type=content_type,
        file_size=file_size,
        status="uploaded",
        file_path=file_path
    )
    db.add(processed_doc)
    db.commit()
    db.refresh(processed_doc)

    # Queue background task for async extraction & analysis
    background_tasks.add_task(
        process_document_in_background,
        doc_id=doc_id,
        org_id=workspace_id,
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type
    )

    return processed_doc


@router.get("", response_model=List[ProcessedDocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return db.query(ProcessedDocument).filter(
        ProcessedDocument.organization_id == workspace_id
    ).order_by(ProcessedDocument.created_at.desc()).all()


@router.get("/{document_id}", response_model=ProcessedDocumentDetailResponse)
def get_document_details(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    doc = db.query(ProcessedDocument).filter(
        ProcessedDocument.id == document_id,
        ProcessedDocument.organization_id == workspace_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}")
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    doc = db.query(ProcessedDocument).filter(
        ProcessedDocument.id == document_id,
        ProcessedDocument.organization_id == workspace_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file using GCSService (GCS with local fallback)
    if doc.file_path:
        try:
            GCSService.delete_file(doc.file_path)
        except Exception as e:
            logger.warning(f"Failed to delete document file: {e}")

    db.delete(doc)
    db.commit()
    return {"status": "success", "message": "Document successfully deleted."}


@router.get("/{document_id}/preview")
def preview_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    doc = db.query(ProcessedDocument).filter(
        ProcessedDocument.id == document_id,
        ProcessedDocument.organization_id == workspace_id
    ).first()
    if not doc or not doc.file_path:
        raise HTTPException(status_code=404, detail="Document file not found")

    try:
        file_bytes = GCSService.download_file(doc.file_path)
        return Response(
            content=file_bytes,
            media_type=doc.content_type,
            headers={"Content-Disposition": f"inline; filename={doc.filename}"}
        )
    except Exception as e:
        logger.error(f"Failed to retrieve preview: {e}")
        raise HTTPException(status_code=404, detail="Document file not found")
