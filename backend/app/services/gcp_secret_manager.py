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
            try:
                import google.auth
                _, default_project = google.auth.default()
                if default_project:
                    project = default_project
            except Exception as e:
                logger.debug(f"Failed to auto-detect project ID: {e}")

        if not project:
            logger.debug("GCP_PROJECT_ID not set and auto-detection failed. Bypassing Secret Manager fetch.")
            return None

        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            name = f"projects/{project}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            # Decode with utf-8-sig, not plain utf-8: secrets created from a
            # UTF-8-with-BOM source (common on Windows) carry a leading BOM
            # (U+FEFF). str.strip() does NOT remove it (U+FEFF is not
            # whitespace in Python), so a plain utf-8 decode leaves e.g.
            # GEMINI_API_KEY = "﻿AIza...". That BOM then reaches the
            # Gemini SDK's gRPC metadata (x-goog-api-key), which must be ASCII,
            # raising "'ascii' codec can't encode character '﻿'" and
            # silently breaking the AI chat stream. utf-8-sig strips a leading
            # BOM if present and is a no-op otherwise.
            return response.payload.data.decode("utf-8-sig").strip()
        except Exception as e:
            logger.warning(
                f"Failed to fetch secret '{secret_id}' from GCP Secret Manager for project '{project}': {e}. "
                "Using local environment fallback."
            )
            return None
