"""
backend/api/config.py

FastAPI application configuration and environment settings.
"""

import os
from pathlib import Path
from typing import List
from pydantic import BaseModel, Field


class Settings(BaseModel):
    PROJECT_NAME: str = "Urbynex"
    API_TITLE: str = "Urbynex Digital Twin & Traffic Simulation API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "AI-Powered Multi-City Smart City Digital Twin & Traffic Simulation Platform"
    API_V1_PREFIX: str = "/api/v1"
    
    # CORS Origins (support Next.js frontend on localhost:3000)
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",
    ]

    # Directories
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    NETWORKS_DIR: Path = DATA_DIR / "networks"
    DOCUMENTS_DIR: Path = DATA_DIR / "documents"
    SIMULATIONS_DIR: Path = DATA_DIR / "simulations"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'urbynex.db'}")

    # JWT Authentication
    JWT_SECRET: str = os.getenv(
        "URBYNEX_JWT_SECRET",
        "urbynex-dev-secret-change-in-production-must-be-32-bytes-minimum",
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = int(os.getenv("URBYNEX_JWT_EXPIRY_HOURS", "1"))

    # Simulation defaults
    DEFAULT_ENGINE: str = "graph_engine_v1"
    MAX_VEHICLE_COUNT: int = 10000
    MAX_DURATION_SECONDS: int = 86400


settings = Settings()
