"""
backend/api/dependencies.py

FastAPI dependency injection providers for database sessions,
repositories, network loaders, simulation engines, and authentication.
"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..db.repository import RunRepository
from ..auth.user_repo import UserRepository
from ..auth.tokens import decode_access_token
from ..simulation.network_loader import NetworkLoader
from ..simulation.engines.graph_engine import GraphEngine

import jwt

# HTTPBearer extracts the Bearer token from the Authorization header.
# auto_error=False lets us return a clean 401 instead of FastAPI's default 403.
_bearer_scheme = HTTPBearer(auto_error=False)


def get_repository(db: Session = Depends(get_db)) -> RunRepository:
    """Provides a RunRepository instance with the active database session."""
    return RunRepository(db=db)


def get_user_repository(db: Session = Depends(get_db)) -> UserRepository:
    """Provides a UserRepository instance with the active database session."""
    return UserRepository(db=db)


def get_network_loader() -> NetworkLoader:
    """Provides a NetworkLoader instance pointing to the data/networks directory."""
    return NetworkLoader()


def get_simulation_engine(loader: NetworkLoader = Depends(get_network_loader)) -> GraphEngine:
    """Provides an initialized GraphEngine instance."""
    return GraphEngine(network_loader=loader)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    user_repo: UserRepository = Depends(get_user_repository),
) -> dict:
    """
    Decodes the Bearer token from the Authorization header and returns the
    current user's payload dict: {user_id, email, role}.

    Raises HTTP 401 if the token is missing, expired, or invalid.
    Raises HTTP 401 if the user no longer exists or is deactivated.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject.",
        )

    user = user_repo.get_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or has been deactivated.",
        )

    return {"user_id": user.user_id, "email": user.email, "role": user.role, "name": user.name}

