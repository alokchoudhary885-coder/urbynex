"""
backend/api/main.py

Urbynex FastAPI Application Entrypoint.
Configures CORS, custom error handling, request ID tracking, database initialization,
and mounts all REST endpoints.
"""

import time
import uuid
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routes import (
    auth_router,
    health_router,
    cities_router,
    scenarios_router,
    simulations_router,
    comparison_router,
)
from ..db.repository import RunRepository
from ..simulation.network_loader import NetworkLoader

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("urbynex.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle handler."""
    logger.info("Initializing Urbynex Digital Twin Backend...")
    try:
        # Initialize SQLite database schema
        RunRepository.init_db()
        logger.info("Database schema verified.")

        # Sync available local road networks into database
        loader = NetworkLoader()
        available_nets = loader.list_available_networks()
        repo = RunRepository()
        for net_meta in available_nets:
            repo.sync_network_metadata(net_meta)
            logger.info(f"Synchronized network: {net_meta.get('network_id')} ({net_meta.get('city_name')})")

        logger.info(f"Urbynex backend initialized with {len(available_nets)} registered networks.")
    except Exception as e:
        logger.error(f"Error during startup initialization: {e}")

    yield

    logger.info("Urbynex backend shutting down...")


# Create FastAPI App instance
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=settings.API_DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID and Timing Middleware
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = req_id
    t_start = time.time()

    response = await call_next(request)

    elapsed_ms = round((time.time() - t_start) * 1000.0, 2)
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)

    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({elapsed_ms}ms)")
    return response


# Validation Error Handler (standardized error payload matching API contracts)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    errors = exc.errors()
    first_err = errors[0] if errors else {}
    field_loc = ".".join([str(loc) for loc in first_err.get("loc", []) if loc != "body"])
    msg = first_err.get("msg", "Invalid request body")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "message": f"Validation error at '{field_loc}': {msg}",
            "field": field_loc or None,
            "request_id": req_id,
        },
    )


# HTTP Error Handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    error_code = "not_found" if exc.status_code == 404 else "request_error"
    if exc.status_code == 409:
        error_code = "conflict"
    elif exc.status_code == 400:
        error_code = "bad_request"

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": error_code,
            "message": exc.detail,
            "request_id": req_id,
        },
    )


# Root Endpoint
@app.get("/", tags=["Root"])
def get_root():
    """Service status and documentation navigation."""
    return {
        "service": "Urbynex Smart City Digital Twin API",
        "tagline": "Simulate Cities. Predict Possibilities.",
        "version": settings.API_VERSION,
        "docs_url": "/docs",
        "api_prefix": "/api",
        "api_v1_prefix": "/api/v1",
        "supported_cities": ["jaipur"],
    }


# Mount Routers under both /api and /api/v1 for uniform access
for prefix in ["/api", "/api/v1"]:
    app.include_router(auth_router, prefix=prefix)
    app.include_router(health_router, prefix=prefix)
    app.include_router(cities_router, prefix=prefix)
    app.include_router(scenarios_router, prefix=prefix)
    app.include_router(simulations_router, prefix=prefix)
    app.include_router(comparison_router, prefix=prefix)
