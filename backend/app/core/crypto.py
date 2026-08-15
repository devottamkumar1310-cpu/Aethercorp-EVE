# ==============================================================================
# PURPOSE: Symmetric encryption for third-party credentials stored at rest.
# DATA FLOW: OAuth callback / channel linking -> encrypt() -> database column;
#            API client -> decrypt() -> outbound request header.
# EXTENSION POINTS: Swap _derive_key() for a KMS-backed key if EVE moves to
#            envelope encryption; the encrypt/decrypt call sites do not change.
# ARCHITECTURAL DECISION:
# - Fernet (AES-128-CBC + HMAC-SHA256) from `cryptography`, already a dependency.
#   Authenticated encryption means a tampered ciphertext fails loudly rather than
#   decrypting to garbage that we would then send to Shopify.
# - The key is derived from INTEGRATION_ENCRYPTION_KEY when set, otherwise from
#   SECRET_KEY. Deriving rather than using SECRET_KEY directly keeps this key
#   domain-separated from JWT signing, so neither can be used to attack the other.
# - Production refuses to run on the default development SECRET_KEY (config.py
#   already enforces this), so there is no path where tokens are encrypted under a
#   publicly known key in production.
# ==============================================================================

import base64
import hashlib
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger("eve.core.crypto")

# Domain separation label. Changing this invalidates every stored ciphertext.
_KEY_INFO = b"eve-integration-credentials-v1"

_fernet: Optional[Fernet] = None


class CredentialDecryptionError(Exception):
    """Raised when stored ciphertext cannot be decrypted (wrong key or tampering)."""


def _derive_key() -> bytes:
    """
    Derives a 32-byte Fernet key from the configured secret.

    A plain SHA-256 over (label || secret) is sufficient here: the input is a
    high-entropy random secret, not a password, so a slow KDF buys nothing.
    """
    raw_secret = getattr(settings, "INTEGRATION_ENCRYPTION_KEY", "") or settings.SECRET_KEY
    digest = hashlib.sha256(_KEY_INFO + raw_secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _cipher() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_derive_key())
    return _fernet


def reset_cipher_cache() -> None:
    """Drops the memoised cipher. Used by tests that mutate the configured secret."""
    global _fernet
    _fernet = None


def encrypt(plaintext: str) -> str:
    """Encrypts a credential for storage. Returns URL-safe base64 ciphertext."""
    if plaintext is None:
        raise ValueError("Cannot encrypt None")
    return _cipher().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    """
    Decrypts a stored credential.

    Raises CredentialDecryptionError rather than returning a placeholder: a caller
    that silently proceeded with an empty token would send unauthenticated requests
    to Shopify and misreport the cause as an upstream auth failure.
    """
    if not ciphertext:
        raise CredentialDecryptionError("No ciphertext supplied")
    try:
        return _cipher().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        # The ciphertext itself is never logged — it is the secret we are protecting.
        logger.error("Failed to decrypt stored credential: key mismatch or tampering.")
        raise CredentialDecryptionError("Stored credential could not be decrypted") from exc


def hash_external_id(value: str) -> str:
    """
    One-way, stable identifier for an external messaging account.

    Salted with the deployment secret so the digests are not comparable against a
    rainbow table of phone numbers — a bare SHA-256 of a phone number is trivially
    reversible given the small keyspace.
    """
    secret = getattr(settings, "INTEGRATION_ENCRYPTION_KEY", "") or settings.SECRET_KEY
    return hashlib.sha256(f"{secret}:{value}".encode("utf-8")).hexdigest()
