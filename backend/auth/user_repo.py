"""
backend/auth/user_repo.py

Repository for user lifecycle operations: registration, lookup, and deactivation.
Keeps auth logic separate from the simulation-focused RunRepository.
"""

import uuid
from typing import Optional
from sqlalchemy.orm import Session

from ..db.session import SessionLocal
from ..db.models import UserModel
from .password import hash_password, verify_password


class UserRepository:
    """Handles database operations for platform users."""

    def __init__(self, db: Optional[Session] = None):
        self._external_db = db

    def _get_session(self) -> Session:
        return self._external_db if self._external_db is not None else SessionLocal()

    def create_user(self, email: str, plain_password: str, name: str, role: str = "planner") -> UserModel:
        """
        Registers a new user. Hashes the password before persisting.

        Raises:
            ValueError: If a user with this email already exists.
        """
        db = self._get_session()
        try:
            if db.query(UserModel).filter_by(email=email.lower().strip()).first():
                raise ValueError(f"A user with email '{email}' already exists.")
            user = UserModel(
                user_id=f"usr_{uuid.uuid4().hex[:12]}",
                email=email.lower().strip(),
                password_hash=hash_password(plain_password),
                name=name.strip(),
                role=role,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            if self._external_db is None:
                db.close()

    def authenticate(self, email: str, plain_password: str) -> Optional[UserModel]:
        """
        Authenticates a user by email and password.

        Returns:
            The UserModel if credentials are valid and the account is active.
            None if the email does not exist, the password is wrong,
            or the account has been deactivated.
        """
        db = self._get_session()
        try:
            user = db.query(UserModel).filter_by(email=email.lower().strip()).first()
            if user is None:
                # Run a dummy verify to maintain constant-time behaviour even on
                # unknown emails (mitigates user enumeration via timing).
                verify_password(plain_password, "scrypt$AAAA$AAAA")
                return None
            if not user.is_active:
                return None
            if not verify_password(plain_password, user.password_hash):
                return None
            return user
        finally:
            if self._external_db is None:
                db.close()

    def get_by_id(self, user_id: str) -> Optional[UserModel]:
        """Fetches a user by their user_id."""
        db = self._get_session()
        try:
            return db.query(UserModel).filter_by(user_id=user_id).first()
        finally:
            if self._external_db is None:
                db.close()

    def get_by_email(self, email: str) -> Optional[UserModel]:
        """Fetches a user by their email address."""
        db = self._get_session()
        try:
            return db.query(UserModel).filter_by(email=email.lower().strip()).first()
        finally:
            if self._external_db is None:
                db.close()
