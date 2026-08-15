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
    # --- AI cost governance (see app/core/ai_runtime.py) ---
    # Hard ceiling on total AI spend per UTC day, across all organizations.
    # Set to 0 to disable. NOTE: the cap is checked pre-flight, so concurrent
    # multi-agent fan-out can overshoot it by roughly the fan-out width — pick
    # this value knowing the real ceiling is cap x concurrent agents.
    AI_DAILY_CAP_USD: float = 25.0
    # Emergency stop. Flipping this in Cloud Run env takes ~1 minute and needs
    # no code deploy.
    AI_KILL_SWITCH: bool = False
    # Upper bound on retries regardless of what a caller requests. The previous
    # per-method default of 10 meant a persistent failure could bill 10 times.
    AI_MAX_RETRIES: int = 3
    # Per-workspace daily AI ceiling. 0 = derive it from the workspace's plan
    # economics (app/core/ai_budget.py), which is the intended behaviour. Set a
    # positive value only to override every plan during an incident.
    # This previously did not exist at all: the orchestrator read it via getattr
    # with a $2/day fallback, so every workspace silently ran on a $60/month
    # ceiling — more than the entry plan's revenue.
    DAILY_ORG_AI_BUDGET: float = 0.0

    FOUNDER_MODE: bool = True
    OWNER_EMAIL: str = "devottamkumar1310@gmail.com"

    # --- Third-party integrations (see docs/INTEGRATIONS.md) ---
    # Public base URL of THIS backend. Shopify, Telegram and Meta all call us at
    # absolute URLs, so the OAuth redirect and webhook endpoints cannot be derived
    # from the request — a proxied request reports the internal host. Falls back to
    # CLOUD_RUN_SERVICE_URL when unset.
    BACKEND_PUBLIC_URL: str = ""
    # Optional dedicated key for encrypting stored integration credentials.
    # Empty -> derived from SECRET_KEY (see app/core/crypto.py).
    INTEGRATION_ENCRYPTION_KEY: str = ""

    # Shopify custom/public app credentials.
    SHOPIFY_API_KEY: str = ""
    SHOPIFY_API_SECRET: str = ""
    SHOPIFY_SCOPES: str = "read_products,read_inventory,read_orders"
    SHOPIFY_API_VERSION: str = "2024-07"
    # How far back the initial order backfill reaches. EVE's forecasting works on
    # daily sell-through, so a quarter of history is enough to seed it without
    # importing years of orders the agents never read.
    SHOPIFY_ORDER_SYNC_DAYS: int = 90

    # Telegram Bot API.
    TELEGRAM_BOT_TOKEN: str = ""
    # Echoed by Telegram in X-Telegram-Bot-Api-Secret-Token on every update.
    TELEGRAM_WEBHOOK_SECRET: str = ""

    # WhatsApp Business Cloud API (Meta).
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_API_VERSION: str = "v21.0"

    # Stripe billing. Test-mode keys (sk_test_.../pk_test_...) work identically
    # to live keys against Stripe's API — nothing else in the app needs to know
    # which mode it's in. Price IDs are per-plan-per-interval (6 total: 3 plans x
    # monthly/annual), created in the Stripe Dashboard against the approved
    # prices in app/core/plans.py.
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_OPERATOR_MONTHLY: str = ""
    STRIPE_PRICE_OPERATOR_ANNUAL: str = ""
    STRIPE_PRICE_COMMAND_MONTHLY: str = ""
    STRIPE_PRICE_COMMAND_ANNUAL: str = ""
    STRIPE_PRICE_CHIEF_MONTHLY: str = ""
    STRIPE_PRICE_CHIEF_ANNUAL: str = ""
    # Trial length offered at Checkout. Matches Profile.trial_end_date's existing
    # pre-Stripe trial so a founder's countdown does not jump when they subscribe.
    STRIPE_TRIAL_DAYS: int = 14

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
            
            # Disable mock mode in production if key is present
            if self.GEMINI_API_KEY:
                self.GEMINI_MOCK_MODE = False

            sec_key = GCPSecretManagerService.get_secret("SECRET_KEY")
            if sec_key:
                self.SECRET_KEY = sec_key

            jwt_sec = GCPSecretManagerService.get_secret("SUPABASE_JWT_SECRET")
            if jwt_sec:
                self.SUPABASE_JWT_SECRET = jwt_sec

            supabase_url = GCPSecretManagerService.get_secret("SUPABASE_URL")
            if supabase_url:
                self.SUPABASE_URL = supabase_url

            anon_key = GCPSecretManagerService.get_secret("SUPABASE_ANON_KEY")
            if anon_key:
                self.SUPABASE_ANON_KEY = anon_key

            service_role_key = GCPSecretManagerService.get_secret("SUPABASE_SERVICE_ROLE_KEY")
            if service_role_key:
                self.SUPABASE_SERVICE_ROLE_KEY = service_role_key

            frontend_url = GCPSecretManagerService.get_secret("FRONTEND_URL")
            if frontend_url:
                self.FRONTEND_URL = frontend_url

            # Integration credentials. Each is optional: a deployment with no
            # Shopify app configured must still boot and serve the rest of EVE,
            # so a missing secret disables that integration rather than failing.
            for _secret_name in (
                "INTEGRATION_ENCRYPTION_KEY",
                "SHOPIFY_API_KEY",
                "SHOPIFY_API_SECRET",
                "TELEGRAM_BOT_TOKEN",
                "TELEGRAM_WEBHOOK_SECRET",
                "WHATSAPP_ACCESS_TOKEN",
                "WHATSAPP_PHONE_NUMBER_ID",
                "WHATSAPP_VERIFY_TOKEN",
                "WHATSAPP_APP_SECRET",
                "BACKEND_PUBLIC_URL",
                "STRIPE_SECRET_KEY",
                "STRIPE_WEBHOOK_SECRET",
                "STRIPE_PRICE_OPERATOR_MONTHLY",
                "STRIPE_PRICE_OPERATOR_ANNUAL",
                "STRIPE_PRICE_COMMAND_MONTHLY",
                "STRIPE_PRICE_COMMAND_ANNUAL",
                "STRIPE_PRICE_CHIEF_MONTHLY",
                "STRIPE_PRICE_CHIEF_ANNUAL",
            ):
                _value = GCPSecretManagerService.get_secret(_secret_name)
                if _value:
                    setattr(self, _secret_name, _value)

        if self.GEMINI_API_KEY:
            self.GEMINI_MOCK_MODE = False

        if self.ENVIRONMENT == "production" or self.ENV == "production":
            if not self.SUPABASE_JWT_SECRET:
                raise ValueError("CRITICAL SECURITY ERROR: SUPABASE_JWT_SECRET must be configured in production environment.")
            if self.SECRET_KEY == "aethercorp-nexus-super-secret-key-replace-in-production":
                raise ValueError("CRITICAL SECURITY ERROR: SECRET_KEY must be changed from the default development key in production environment.")


    # Pydantic Configuration
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Instantiate settings container globally
settings = Settings()

