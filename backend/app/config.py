# ==============================================================================
# PURPOSE: Application Configuration management using Pydantic Settings.
# DATA FLOW: Reads variables from the environment and .env, presenting them as typed attributes.
# EXTENSION POINTS: Add new fields here when integrating third-party APIs (e.g., Shopify, Slack).
# ARCHITECTURAL DECISION:
# - Using pydantic-settings ensures type safety, failing fast at boot time if configuration
#   is malformed or missing rather than runtime errors.
# ==============================================================================

import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings holds all environmental variable properties.
    Loads from environment directly, with fallback to .env files.
    """
    ENV: str = "development"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/eve"
    GEMINI_API_KEY: str = ""
    GEMINI_MOCK_MODE: bool = True
    SECRET_KEY: str = "aethercorp-nexus-super-secret-key-replace-in-production"
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    CLOUD_RUN_SERVICE_URL: Optional[str] = None
    GCS_BUCKET_NAME: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    FOUNDER_MODE: bool = True

    def __init__(self, **values):
        super().__init__(**values)
        if os.environ.get("GCP_PROJECT_ID") or self.ENVIRONMENT == "production":
            from app.services.gcp_secret_manager import GCPSecretManagerService
            
            db_url = GCPSecretManagerService.get_secret("DATABASE_URL")
            if db_url:
                self.DATABASE_URL = db_url

            gemini_key = GCPSecretManagerService.get_secret("GEMINI_API_KEY")
            if gemini_key:
                self.GEMINI_API_KEY = gemini_key

            sec_key = GCPSecretManagerService.get_secret("SECRET_KEY")
            if sec_key:
                self.SECRET_KEY = sec_key

            jwt_sec = GCPSecretManagerService.get_secret("SUPABASE_JWT_SECRET")
            if jwt_sec:
                self.SUPABASE_JWT_SECRET = jwt_sec

            anon_key = GCPSecretManagerService.get_secret("SUPABASE_ANON_KEY")
            if anon_key:
                self.SUPABASE_ANON_KEY = anon_key

            service_role_key = GCPSecretManagerService.get_secret("SUPABASE_SERVICE_ROLE_KEY")
            if service_role_key:
                self.SUPABASE_SERVICE_ROLE_KEY = service_role_key

            frontend_url = GCPSecretManagerService.get_secret("FRONTEND_URL")
            if frontend_url:
                self.FRONTEND_URL = frontend_url


    # Pydantic Configuration
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Instantiate settings container globally
settings = Settings()

