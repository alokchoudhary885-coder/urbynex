"""
backend/api/routes/health.py

Health check and system diagnostics endpoint.
"""

from fastapi import APIRouter
from ..schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Returns application health and operational status."""
    return HealthResponse()
