"""
backend/api/routes/auth.py

Authentication endpoints: user registration, JWT login, and current user profile.
- POST /auth/register — Public. Creates account and returns a JWT.
- POST /auth/login    — Public. Validates credentials and returns a JWT.
- GET  /auth/me       — Protected. Returns the authenticated user's profile.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from ..dependencies import get_user_repository, get_current_user
from ...auth.tokens import create_access_token
from ...auth.user_repo import UserRepository
from ...api.config import settings

router = APIRouter(tags=["Authentication"])


@router.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    req: RegisterRequest,
    user_repo: UserRepository = Depends(get_user_repository),
) -> TokenResponse:
    """
    Creates a new Urbynex user account and immediately issues an access token.
    Returns 409 if the email address is already registered.
    """
    try:
        user = user_repo.create_user(
            email=req.email,
            plain_password=req.password,
            name=req.name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        expiry_hours=settings.JWT_EXPIRY_HOURS,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRY_HOURS * 3600,
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        role=user.role,
    )


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Authenticate and receive a JWT access token",
)
def login(
    req: LoginRequest,
    user_repo: UserRepository = Depends(get_user_repository),
) -> TokenResponse:
    """
    Validates email + password and issues a signed JWT.
    Always returns 401 on any credential failure to prevent user enumeration.
    """
    user = user_repo.authenticate(email=req.email, plain_password=req.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        role=user.role,
        expiry_hours=settings.JWT_EXPIRY_HOURS,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRY_HOURS * 3600,
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        role=user.role,
    )


@router.get(
    "/auth/me",
    response_model=UserResponse,
    summary="Get the current authenticated user's profile",
)
def get_me(
    current_user: dict = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repository),
) -> UserResponse:
    """
    Returns the profile of the currently authenticated user.
    Requires a valid Bearer token in the Authorization header.
    """
    user = user_repo.get_by_id(current_user["user_id"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User record not found.",
        )
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )
