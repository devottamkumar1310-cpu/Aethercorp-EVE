import os
import hashlib
import logging
import uuid
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.document import ProcessedDocument
from app.services.gcs_service import GCSService

logger = logging.getLogger("eve.services.upload_security_service")

# 50MB Organization Storage Quota limit
ORGANIZATION_QUOTA_BYTES = 50 * 1024 * 1024


class UploadSecurityService:
    @staticmethod
    def validate_magic_bytes(file_bytes: bytes, file_ext: str) -> bool:
        """
        Validates the file's binary magic signatures against the expected extension.
        Using a highly robust, pure-python byte signature verification to prevent
        native DLL/access violation crashes (like libmagic memory errors on Windows).
        """
        ext = file_ext.lower().strip()
        if not ext.startswith("."):
            ext = "." + ext

        # Pure-python binary signature validation (failsafe and platform-independent)
        if ext == ".pdf":
            return file_bytes.startswith(b"%PDF")
        elif ext == ".png":
            return file_bytes.startswith(b"\x89PNG\r\n\x1a\n")
        elif ext in [".jpg", ".jpeg"]:
            return file_bytes.startswith(b"\xff\xd8\xff")
        elif ext == ".xlsx":
            return file_bytes.startswith(b"PK\x03\x04")
        elif ext == ".csv":
            # Ensure no null bytes and text structure
            if b"\x00" in file_bytes:
                return False
            try:
                file_bytes.decode("utf-8")
                return True
            except UnicodeDecodeError:
                try:
                    file_bytes.decode("latin-1")
                    return True
                except Exception:
                    return False
        return False

    @staticmethod
    def enforce_quota(db: Session, org_id: uuid.UUID, new_file_size: int) -> None:
        """
        Sums up the storage consumed by active documents for an organization.
        Raises 400 Bad Request if the new file exceeds the 50MB quota.
        """
        used_bytes = db.query(func.sum(ProcessedDocument.file_size)).filter(
            ProcessedDocument.organization_id == org_id,
            ProcessedDocument.status != "failure"
        ).scalar() or 0

        if used_bytes + new_file_size > ORGANIZATION_QUOTA_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Upload rejected. Organization storage quota exceeded. Used: {used_bytes} bytes. Quota: {ORGANIZATION_QUOTA_BYTES} bytes."
            )

    @staticmethod
    def process_sha256_and_detect_duplicate(db: Session, org_id: uuid.UUID, file_bytes: bytes) -> str:
        """
        Computes SHA-256 hash of the upload.
        Rejects upload if the same hash exists for the same organization.
        """
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        
        duplicate = db.query(ProcessedDocument).filter(
            ProcessedDocument.organization_id == org_id,
            ProcessedDocument.sha256_hash == sha256_hash,
            ProcessedDocument.status != "failure"
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This document has already been uploaded to this workspace."
            )

        return sha256_hash

    @staticmethod
    def get_storage_usage(db: Session, org_id: uuid.UUID) -> Dict[str, Any]:
        """
        Returns file count and byte footprint for the organization.
        """
        total_files = db.query(ProcessedDocument).filter(
            ProcessedDocument.organization_id == org_id,
            ProcessedDocument.status != "failure"
        ).count()

        used_bytes = db.query(func.sum(ProcessedDocument.file_size)).filter(
            ProcessedDocument.organization_id == org_id,
            ProcessedDocument.status != "failure"
        ).scalar() or 0

        return {
            "total_files": total_files,
            "used_bytes": used_bytes,
            "quota_bytes": ORGANIZATION_QUOTA_BYTES
        }

    @staticmethod
    def cleanup_orphaned_uploads(db: Session) -> Dict[str, Any]:
        """
        Scans local 'uploads' directory and deletes files that do not exist
        in the database or belong to a failed processed document record.
        """
        upload_dir = "uploads"
        if not os.path.exists(upload_dir):
            return {"status": "success", "cleaned_files": []}

        cleaned = []
        # Get all valid files listed in database
        active_paths = set(
            row[0] for row in db.query(ProcessedDocument.file_path).filter(
                ProcessedDocument.status != "failure"
            ).all() if row[0]
        )

        for filename in os.listdir(upload_dir):
            file_path = os.path.join(upload_dir, filename)
            if not os.path.isfile(file_path):
                continue
            
            # Normalize path format
            normalized_path = file_path.replace("\\", "/")
            
            # If the file path is not actively registered under a successful DB document, delete it
            if normalized_path not in active_paths:
                try:
                    os.remove(file_path)
                    cleaned.append(normalized_path)
                except Exception as e:
                    logger.warning(f"Failed to remove orphaned file {file_path}: {e}")

        return {"status": "success", "cleaned_files": cleaned}
