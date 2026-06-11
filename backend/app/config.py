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
    FRONTEND_URL: str = "http://localhost:3000"
    CLOUD_RUN_SERVICE_URL: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Pydantic Configuration
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Instantiate settings container globally
settings = Settings()
