import os
import logging
from typing import Optional

logger = logging.getLogger("eve.services.gcp_secret_manager")


class GCPSecretManagerService:
    @staticmethod
    def get_secret(secret_id: str, project_id: Optional[str] = None) -> Optional[str]:
        """
        Retrieves a secret version from Google Cloud Secret Manager.
        If project_id is not specified, it falls back to GCP_PROJECT_ID or returns None.
        Returns None on any error or missing client library to support clean local fallback.
        """
        project = project_id or os.environ.get("GCP_PROJECT_ID")
        if not project:
            logger.debug("GCP_PROJECT_ID not set. Bypassing Secret Manager fetch.")
            return None

        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            name = f"projects/{project}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8").strip()
        except Exception as e:
            logger.warning(
                f"Failed to fetch secret '{secret_id}' from GCP Secret Manager for project '{project}': {e}. "
                "Using local environment fallback."
            )
            return None
