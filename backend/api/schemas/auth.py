"""
backend/api/schemas/auth.py

Pydantic request/response schemas for authentication endpoints.
"""

import re
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    """Request body for POST /api/auth/register."""

    email: str
    password: str
    name: str

    @field_validator("email")
    @classmethod
    def email_must_be_valid(cls, v: str) -> str:
        v = v.strip().lower()
        pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Must be a valid email address.")
        return v

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    @field_validator("name")
    @classmethod
    def name_must_be_present(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty.")
        if len(v) > 128:
            raise ValueError("Name must not exceed 128 characters.")
        return v


class LoginRequest(BaseModel):
    """Request body for POST /api/auth/login."""

    email: str
    password: str


class TokenResponse(BaseModel):
    """Issued JWT token and metadata returned after successful login or registration."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until token expiry
    user_id: str
    email: str
    name: str
    role: str


class UserResponse(BaseModel):
    """Public user profile (no password hash exposed)."""

    user_id: str
    email: str
    name: str
    role: str
    is_active: bool
    created_at: Optional[str] = None


class CurrentUser(BaseModel):
    """Deserialized current user injected by the auth dependency."""

    user_id: str
    email: str
    role: str
