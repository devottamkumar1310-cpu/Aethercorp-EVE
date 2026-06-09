# ==============================================================================
# PURPOSE: Service layer managing compilation and retrieval of structured Artifacts.
# DATA FLOW: Takes raw calculations -> formats into report schemas -> saves to DB Artifact table.
# EXTENSION POINTS: Add PDF exporter modules, email dispatch queues, or Slack notification hooks.
# ARCHITECTURAL DECISION:
# - Serves as the persistence layer for all multi-agent workflow outputs.
# ==============================================================================

import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.artifact import Artifact
from app.schemas.artifact import ArtifactSchema

logger = logging.getLogger("eve.services.report_service")


class ReportService:
    """
    Service layer handling saving and loading of structured reports (Artifacts).
    """

    @classmethod
    def save_artifact(
        self,
        db: Session,
        organization_id: int,
        artifact_type: str,
        title: str,
        content: dict
    ) -> Artifact:
        """
        Saves a structured report payload into the DB. Increments version if matching exists.
        """
        logger.info(f"Saving artifact '{title}' ({artifact_type}) for Org: {organization_id}...")
        
        # Check if an artifact of same type already exists for organization
        existing = db.query(Artifact).filter(
            Artifact.organization_id == organization_id,
            Artifact.artifact_type == artifact_type
        ).first()

        if existing:
            existing.title = title
            existing.structured_content = content
            existing.version += 1
            db.commit()
            db.refresh(existing)
            logger.info(f"Updated existing artifact ID {existing.id} to version {existing.version}.")
            return existing

        # Create new record
        new_artifact = Artifact(
            organization_id=organization_id,
            artifact_type=artifact_type,
            title=title,
            structured_content=content,
            version=1
        )
        db.add(new_artifact)
        db.commit()
        db.refresh(new_artifact)
        logger.info(f"Created new artifact ID {new_artifact.id}.")
        return new_artifact

    @classmethod
    def get_artifact(
        self,
        db: Session,
        organization_id: int,
        artifact_type: str
    ) -> Optional[Artifact]:
        """
        Retrieves the latest version of a specific report.
        """
        return db.query(Artifact).filter(
            Artifact.organization_id == organization_id,
            Artifact.artifact_type == artifact_type
        ).first()

    @classmethod
    def list_artifacts(self, db: Session, organization_id: int) -> List[Artifact]:
        """
        Lists all reports for an organization.
        """
        return db.query(Artifact).filter(Artifact.organization_id == organization_id).all()


# Register ReportService inside Container
from app.core.dependency_container import container
container.register_singleton("report_service", ReportService())
