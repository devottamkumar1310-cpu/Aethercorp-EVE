# ==============================================================================
# PURPOSE: Shopify OAuth 2.0 authorization-code flow.
# DATA FLOW: build_install_url() -> Shopify consent screen -> callback ->
#            verify_callback() -> exchange_code() -> encrypted ShopifyConnection row.
# EXTENSION POINTS: Add online (per-user) access tokens if EVE ever needs to act as
#            the merchant staff member rather than as the app.
# ARCHITECTURAL DECISION:
# - `state` is BOTH a signed value and a single-use database row. The signature
#   proves EVE minted it; consuming the row prevents replay of a captured callback.
# - The callback HMAC is verified over the raw query string per Shopify's spec, using
#   a constant-time comparison — a byte-by-byte compare leaks the digest by timing.
# - Offline access tokens (the default) are used: EVE syncs on a schedule and via
#   webhooks, both of which happen with no user present.
# ==============================================================================

import datetime
import hashlib
import hmac
import logging
import secrets
import uuid
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.core.crypto import encrypt
from app.database import as_naive_utc
from app.models.shopify import ShopifyConnection, ShopifyOAuthState
from app.services.shopify.client import normalize_shop_domain

logger = logging.getLogger("eve.services.shopify.oauth_service")

STATE_TTL_MINUTES = 10
_TOKEN_EXCHANGE_TIMEOUT = 20.0


class ShopifyOAuthError(Exception):
    """Raised when an OAuth step fails validation."""


def is_configured() -> bool:
    """True when this deployment has Shopify app credentials."""
    return bool(settings.SHOPIFY_API_KEY and settings.SHOPIFY_API_SECRET)


def backend_public_url() -> str:
    """
    Absolute public base URL of this backend.

    Shopify redirects a browser here, so it must be the externally reachable URL.
    It cannot be derived from the incoming request: behind Cloud Run's proxy the
    request host is the internal one.
    """
    configured = (settings.BACKEND_PUBLIC_URL or settings.CLOUD_RUN_SERVICE_URL or "").strip()
    return configured.rstrip("/")


def redirect_uri() -> str:
    """The OAuth callback URL registered in the Shopify app configuration."""
    return f"{backend_public_url()}/api/integrations/shopify/callback"


class ShopifyOAuthService:
    @staticmethod
    def create_state(
        db: Session,
        organization_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        shop_domain: str,
    ) -> str:
        """Mints and persists a single-use state nonce bound to this workspace."""
        now = datetime.datetime.utcnow()
        state = secrets.token_urlsafe(32)

        db.add(
            ShopifyOAuthState(
                state=state,
                organization_id=organization_id,
                user_id=user_id,
                shop_domain=shop_domain,
                created_at=now,
                expires_at=now + datetime.timedelta(minutes=STATE_TTL_MINUTES),
            )
        )
        db.commit()
        return state

    @staticmethod
    def consume_state(db: Session, state: str, shop_domain: str) -> Optional[ShopifyOAuthState]:
        """
        Validates and burns a state nonce.

        Returns None when the state is unknown, expired, already used, or was issued
        for a different shop. The shop check matters: without it, a state minted for
        the attacker's own store could be replayed to attach a victim's store to the
        attacker's workspace.
        """
        now = datetime.datetime.utcnow()
        record = (
            db.query(ShopifyOAuthState)
            .filter(
                ShopifyOAuthState.state == state,
                ShopifyOAuthState.consumed_at.is_(None),
            )
            .first()
        )
        if not record:
            logger.warning("Shopify callback rejected: unknown or already-used state.")
            return None
        if as_naive_utc(record.expires_at) <= now:
            logger.warning("Shopify callback rejected: expired state.")
            return None
        if record.shop_domain != shop_domain:
            logger.warning("Shopify callback rejected: state/shop mismatch.")
            return None

        record.consumed_at = now
        db.commit()
        return record

    @staticmethod
    def build_install_url(shop_domain: str, state: str) -> str:
        """Builds the Shopify consent URL the founder's browser is sent to."""
        query = urlencode(
            {
                "client_id": settings.SHOPIFY_API_KEY,
                "scope": settings.SHOPIFY_SCOPES,
                "redirect_uri": redirect_uri(),
                "state": state,
            }
        )
        return f"https://{shop_domain}/admin/oauth/authorize?{query}"

    @staticmethod
    def verify_callback_hmac(query_params: Dict[str, Any]) -> bool:
        """
        Verifies the `hmac` Shopify appends to the callback.

        Per Shopify's spec the digest covers every query parameter except `hmac`
        itself, sorted and urlencoded. A failure here means the callback was not
        produced by Shopify and must be discarded before the code is exchanged.
        """
        supplied = query_params.get("hmac")
        if not supplied or not settings.SHOPIFY_API_SECRET:
            return False

        message = urlencode(
            sorted((key, value) for key, value in query_params.items() if key != "hmac")
        )
        expected = hmac.new(
            settings.SHOPIFY_API_SECRET.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, supplied)

    @staticmethod
    async def exchange_code(shop_domain: str, code: str) -> Tuple[str, str]:
        """
        Exchanges the authorization code for a permanent offline access token.
        Returns (access_token, granted_scopes).
        """
        url = f"https://{shop_domain}/admin/oauth/access_token"
        payload = {
            "client_id": settings.SHOPIFY_API_KEY,
            "client_secret": settings.SHOPIFY_API_SECRET,
            "code": code,
        }

        async with httpx.AsyncClient(timeout=_TOKEN_EXCHANGE_TIMEOUT) as http:
            response = await http.post(url, json=payload)

        if response.status_code >= 400:
            # The body can echo the client_secret back in an error envelope, so it
            # is never logged or surfaced.
            logger.error(
                "Shopify token exchange failed for %s with status %s.",
                shop_domain,
                response.status_code,
            )
            raise ShopifyOAuthError("Shopify rejected the authorization code.")

        body = response.json()
        token = body.get("access_token")
        if not token:
            raise ShopifyOAuthError("Shopify did not return an access token.")

        return token, body.get("scope", "") or ""

    @staticmethod
    def upsert_connection(
        db: Session,
        organization_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        shop_domain: str,
        access_token: str,
        scopes: str,
    ) -> ShopifyConnection:
        """
        Stores the connection, encrypting the token at rest.

        A shop already connected to a DIFFERENT workspace is refused rather than
        reassigned: silently moving it would hand one tenant the other's store data.
        Reconnecting the same workspace refreshes the token in place.
        """
        existing = (
            db.query(ShopifyConnection)
            .filter(ShopifyConnection.shop_domain == shop_domain)
            .first()
        )

        if existing and existing.organization_id != organization_id:
            logger.warning(
                "Refused to attach shop %s to workspace %s: already owned by %s.",
                shop_domain,
                organization_id,
                existing.organization_id,
            )
            raise ShopifyOAuthError(
                "This Shopify store is already connected to another EVE workspace. "
                "Disconnect it there first."
            )

        now = datetime.datetime.utcnow()
        if existing:
            existing.access_token_encrypted = encrypt(access_token)
            existing.scopes = scopes
            existing.api_version = settings.SHOPIFY_API_VERSION
            existing.status = "connected"
            existing.last_error = None
            existing.connected_by_user_id = user_id or existing.connected_by_user_id
            existing.updated_at = now
            connection = existing
        else:
            connection = ShopifyConnection(
                organization_id=organization_id,
                connected_by_user_id=user_id,
                shop_domain=shop_domain,
                access_token_encrypted=encrypt(access_token),
                scopes=scopes,
                api_version=settings.SHOPIFY_API_VERSION,
                status="connected",
                sync_status="idle",
                webhook_ids=[],
                created_at=now,
                updated_at=now,
            )
            db.add(connection)

        db.commit()
        db.refresh(connection)
        logger.info(
            "Shopify store %s connected to workspace %s.", shop_domain, organization_id
        )
        return connection

    @staticmethod
    def validate_shop_param(shop: str) -> str:
        """Normalises a caller-supplied shop domain or raises."""
        normalized = normalize_shop_domain(shop)
        if not normalized:
            raise ShopifyOAuthError(
                "Enter a valid Shopify store domain, e.g. your-store.myshopify.com"
            )
        return normalized
