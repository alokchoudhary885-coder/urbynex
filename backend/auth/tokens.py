"""
backend/auth/tokens.py

JWT access token creation and decoding for Urbynex authentication.
Uses the PyJWT library (HS256 algorithm, configurable secret and expiry).

Token payload structure:
    {
        "sub":   "<user_id>",        # Subject — unique user identifier
        "email": "<user@email.com>", # Email address (informational)
        "role":  "<planner|admin>",  # User role for downstream authorization
        "iat":   <unix_timestamp>,   # Issued-at time
        "exp":   <unix_timestamp>    # Expiry time (default: 1 hour from issue)
    }

Security notes:
- The secret key must be at least 32 bytes (256 bits) for HS256 per RFC 7518 §3.2.
- Tokens are bearer tokens and should be transmitted over HTTPS only.
- Expiry is enforced by PyJWT on decode; expired tokens raise ExpiredSignatureError.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import jwt

# Configuration keys — read from settings in production usage.
# Imported lazily to avoid circular imports with api.config.
_DEFAULT_SECRET = "CHANGEME-use-a-real-32-byte-env-secret-in-production"
_DEFAULT_ALGORITHM = "HS256"
_DEFAULT_EXPIRY_HOURS = 1


def _get_settings():
    """Lazy import of settings to avoid circular imports."""
    try:
        from backend.api.config import settings
        return settings.JWT_SECRET, settings.JWT_ALGORITHM, settings.JWT_EXPIRY_HOURS
    except Exception:
        return _DEFAULT_SECRET, _DEFAULT_ALGORITHM, _DEFAULT_EXPIRY_HOURS


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    expiry_hours: Optional[int] = None,
) -> str:
    """
    Creates a signed JWT access token for the given user.

    Args:
        user_id:      The platform user's unique identifier.
        email:        The user's email address.
        role:         The user's role (admin, planner, viewer).
        expiry_hours: Optional override for token lifetime in hours.

    Returns:
        A signed JWT string.
    """
    secret, algorithm, default_expiry = _get_settings()
    hours = expiry_hours if expiry_hours is not None else default_expiry

    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=hours),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT access token.

    Args:
        token: The raw JWT string from an Authorization header.

    Returns:
        The decoded payload dict.

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.InvalidTokenError:     If the token is malformed or signature is invalid.
    """
    secret, algorithm, _ = _get_settings()
    return jwt.decode(token, secret, algorithms=[algorithm])
