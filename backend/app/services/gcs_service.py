import os
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger("eve.services.gcs_service")


class GCSService:
    _client = None

    @classmethod
    def _get_client(cls):
        if not settings.GCS_BUCKET_NAME:
            return None
        if cls._client is None:
            try:
                from google.cloud import storage
                cls._client = storage.Client()
            except Exception as e:
                logger.warning(f"Could not initialize Google Cloud Storage Client: {e}. Storing locally.")
        return cls._client

    @classmethod
    def upload_file(cls, filename: str, file_bytes: bytes, content_type: str) -> str:
        """
        Uploads a file and returns the destination file path/GCS URI.
        If GCS bucket is not configured, it writes to a local uploads directory.
        """
        bucket_name = settings.GCS_BUCKET_NAME
        client = cls._get_client()
        is_prod = (settings.ENV == "production" or settings.ENVIRONMENT == "production")

        if is_prod:
            if not bucket_name:
                raise ValueError("GCS_BUCKET_NAME must be configured in production environment.")
            if not client:
                raise RuntimeError("Could not initialize Google Cloud Storage Client in production environment.")
            try:
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(filename)
                blob.upload_from_string(file_bytes, content_type=content_type)
                return f"gs://{bucket_name}/{filename}"
            except Exception as e:
                logger.critical(f"Production GCS Upload failed: {e}")
                raise RuntimeError(f"GCS Upload failed in production: {e}")

        if bucket_name and client:
            try:
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(filename)
                blob.upload_from_string(file_bytes, content_type=content_type)
                # Return GCS URI
                return f"gs://{bucket_name}/{filename}"
            except Exception as e:
                logger.error(f"GCS Upload failed: {e}. Falling back to local upload.")

        # Fallback: Local Storage
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, filename)
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        return local_path

    @classmethod
    def download_file(cls, file_path: str) -> bytes:
        """
        Downloads a file using its GCS URI or local path.
        """
        if file_path.startswith("gs://"):
            parts = file_path.replace("gs://", "").split("/", 1)
            bucket_name = parts[0]
            blob_name = parts[1]
            
            client = cls._get_client()
            if client:
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(blob_name)
                return blob.download_as_bytes()
            raise Exception("GCS client not initialized but GCS path was requested.")

        # Fallback: Local Storage
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                return f.read()
        raise FileNotFoundError(f"File not found at {file_path}")

    @classmethod
    def delete_file(cls, file_path: str) -> None:
        """
        Deletes a file from GCS or local storage.
        """
        if file_path.startswith("gs://"):
            parts = file_path.replace("gs://", "").split("/", 1)
            bucket_name = parts[0]
            blob_name = parts[1]
            
            client = cls._get_client()
            if client:
                try:
                    bucket = client.bucket(bucket_name)
                    blob = bucket.blob(blob_name)
                    blob.delete()
                except Exception as e:
                    logger.warning(f"Failed to delete GCS file {file_path}: {e}")
            return

        # Fallback: Local Storage
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete local file {file_path}: {e}")
