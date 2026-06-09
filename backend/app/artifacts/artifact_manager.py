# ==============================================================================
# PURPOSE: Artifact Manager.
# DATA FLOW: Interacts with the DB and services to query, validate, and serialize reports.
# EXTENSION POINTS: Add file export systems (Excel, CSV, PDF) or email dispatchers.
# ARCHITECTURAL DECISION:
# - Wraps ReportService to manage structural persistence of multi-agent reports.
# ==============================================================================

import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.artifact import Artifact
from app.core.dependency_container import container

logger = logging.getLogger("eve.artifacts.artifact_manager")


class ArtifactManager:
    """
    Manager responsible for loading and formatting workflow reports.
    """
    def __init__(self):
        self.report_service = container.get("report_service")

    def get_latest_report(self, db: Session, organization_id: int, report_type: str) -> Optional[Artifact]:
        """
        Retrieves the latest version of a specific report.
        """
        return self.report_service.get_artifact(db, organization_id, report_type)

    def list_organization_reports(self, db: Session, organization_id: int) -> List[Artifact]:
        """
        Retrieves all reports created for an organization.
        """
        return self.report_service.list_artifacts(db, organization_id)
        
    def save_report(self, db: Session, organization_id: int, report_type: str, title: str, content: dict) -> Artifact:
        """
        Saves or updates a report.
        """
        return self.report_service.save_artifact(db, organization_id, report_type, title, content)


# Register ArtifactManager inside Container
container.register_singleton("artifact_manager", ArtifactManager())
