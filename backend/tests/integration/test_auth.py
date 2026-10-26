"""
backend/tests/integration/test_auth.py

Integration tests for M2.2 Authentication endpoints.
Verifies user registration, JWT login, profile retrieval,
duplicate registration rejection, and invalid credential handling.
All tests run against the real database and real JWT implementation.
"""

import pytest
from starlette.testclient import TestClient
from backend.api.main import app
from backend.db.repository import RunRepository


@pytest.fixture(scope="module")
def client():
    RunRepository.init_db()
    from backend.db.session import SessionLocal
    from backend.db.models import UserModel
    db = SessionLocal()
    try:
        db.query(UserModel).delete()
        db.commit()
    finally:
        db.close()
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Registration tests
# ---------------------------------------------------------------------------

def test_register_new_user(client):
    """Registering a new user returns 201 with a valid access token."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": "alok@urbynex.dev",
            "password": "SecurePass123",
            "name": "Alok Choudhary",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["email"] == "alok@urbynex.dev"
    assert data["name"] == "Alok Choudhary"
    assert data["role"] == "planner"
    assert data["expires_in"] == 3600
    assert len(data["access_token"]) > 50  # JWT is not empty


def test_register_duplicate_email_returns_409(client):
    """Registering the same email twice returns 409 Conflict."""
    payload = {
        "email": "duplicate@urbynex.dev",
        "password": "SecurePass123",
        "name": "First User",
    }
    # First registration should succeed
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201, r1.text

    # Second registration must fail with 409
    r2 = client.post("/api/auth/register", json=payload)
    assert r2.status_code == 409
    data = r2.json()
    err_msg = data.get("message", data.get("detail", "")).lower()
    assert "already exists" in err_msg


def test_register_invalid_email_returns_422(client):
    """Providing a malformed email returns a validation error."""
    res = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "password": "ValidPass1", "name": "Test"},
    )
    assert res.status_code == 422


def test_register_short_password_returns_422(client):
    """Passwords shorter than 8 characters are rejected."""
    res = client.post(
        "/api/auth/register",
        json={"email": "shortpass@urbynex.dev", "password": "abc", "name": "Test"},
    )
    assert res.status_code == 422


def test_register_empty_name_returns_422(client):
    """Empty name field is rejected during registration."""
    res = client.post(
        "/api/auth/register",
        json={"email": "noname@urbynex.dev", "password": "ValidPass1", "name": "   "},
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------

def test_login_with_valid_credentials(client):
    """Login with correct email and password returns a JWT token."""
    # Register first
    client.post(
        "/api/auth/register",
        json={
            "email": "logintest@urbynex.dev",
            "password": "MyPassword99",
            "name": "Login Tester",
        },
    )
    # Now login
    res = client.post(
        "/api/auth/login",
        json={"email": "logintest@urbynex.dev", "password": "MyPassword99"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["email"] == "logintest@urbynex.dev"
    assert data["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client):
    """Providing the wrong password returns 401, not 400 or 404."""
    client.post(
        "/api/auth/register",
        json={
            "email": "wrongpass@urbynex.dev",
            "password": "CorrectPass1",
            "name": "Wrong Pass Test",
        },
    )
    res = client.post(
        "/api/auth/login",
        json={"email": "wrongpass@urbynex.dev", "password": "BadPassword1"},
    )
    assert res.status_code == 401
    err_data = res.json()
    err_msg = err_data.get("message", err_data.get("detail", ""))
    assert "Invalid email or password" in err_msg


def test_login_nonexistent_email_returns_401(client):
    """Login with an email that does not exist returns 401, not 404 (prevents enumeration)."""
    res = client.post(
        "/api/auth/login",
        json={"email": "nobody@urbynex.dev", "password": "SomePass1"},
    )
    assert res.status_code == 401


def test_login_case_insensitive_email(client):
    """Email matching is case-insensitive at registration and login."""
    client.post(
        "/api/auth/register",
        json={"email": "CaseTest@urbynex.dev", "password": "TestPass123", "name": "Case Test"},
    )
    # Login with uppercase email should work
    res = client.post(
        "/api/auth/login",
        json={"email": "CASETEST@urbynex.dev", "password": "TestPass123"},
    )
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# /auth/me tests
# ---------------------------------------------------------------------------

def test_get_me_with_valid_token(client):
    """Authenticated GET /auth/me returns the user's profile."""
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "metest@urbynex.dev",
            "password": "MePass123",
            "name": "Me Tester",
        },
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["email"] == "metest@urbynex.dev"
    assert data["name"] == "Me Tester"
    assert data["role"] == "planner"
    assert data["is_active"] is True


def test_get_me_without_token_returns_401(client):
    """Calling /auth/me without a token returns 401."""
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_get_me_with_invalid_token_returns_401(client):
    """Calling /auth/me with a garbage token returns 401."""
    res = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
    )
    assert res.status_code == 401
