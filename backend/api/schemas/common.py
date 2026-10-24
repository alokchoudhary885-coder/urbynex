"""
backend/api/schemas/common.py

Common response schemas, standard error structures, and health response.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standard error response adhering to API specification."""
    error: str = Field(description="Error category code (e.g. not_found, validation_error)")
    message: str = Field(description="Human-readable error description")
    field: Optional[str] = Field(default=None, description="Request field that caused the error, if applicable")
    request_id: Optional[str] = Field(default=None, description="Tracking request UUID")


class HealthResponse(BaseModel):
    """Service health status response."""
    status: str = "healthy"
    version: str = "1.0.0"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    environment: str = "development"
    database: str = "connected"
    simulation_engine: str = "ready"
