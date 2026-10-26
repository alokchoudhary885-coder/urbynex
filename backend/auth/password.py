"""
backend/auth/password.py

Secure password hashing and verification using Python's built-in hashlib.scrypt.
No external bcrypt dependency — scrypt is available in the standard library since Python 3.6.

Algorithm:
  scrypt(N=16384, r=8, p=1) with a random 16-byte salt.
  Output is encoded as:  scrypt$<base64-salt>$<base64-derived-key>

RFC 7914 recommends N=2^14 (16384) as a reasonable minimum for interactive logins
given 2025-era hardware. The resulting 64-byte key is compared with hmac.compare_digest
to prevent timing-based enumeration of registered emails.
"""

import base64
import hashlib
import hmac
import os


def hash_password(plain_password: str) -> str:
    """
    Hashes a plain-text password with a fresh random salt using scrypt.

    Returns a storable string in the format:
        scrypt$<base64-salt>$<base64-key>
    """
    salt = os.urandom(16)
    key = hashlib.scrypt(
        plain_password.encode("utf-8"),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        maxmem=32 * 1024 * 1024,  # 32 MiB max memory
    )
    salt_b64 = base64.b64encode(salt).decode("ascii")
    key_b64 = base64.b64encode(key).decode("ascii")
    return f"scrypt${salt_b64}${key_b64}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored scrypt hash.

    Returns True only if the hash matches; False on any mismatch or format error.
    Uses constant-time comparison to prevent timing attacks.
    """
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3 or parts[0] != "scrypt":
            return False
        salt = base64.b64decode(parts[1])
        expected_key = base64.b64decode(parts[2])
        actual_key = hashlib.scrypt(
            plain_password.encode("utf-8"),
            salt=salt,
            n=16384,
            r=8,
            p=1,
            maxmem=32 * 1024 * 1024,
        )
        return hmac.compare_digest(expected_key, actual_key)
    except Exception:
        return False
