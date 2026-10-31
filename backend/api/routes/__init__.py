"""Urbynex API Routes Package"""
from .auth import router as auth_router
from .health import router as health_router
from .cities import router as cities_router
from .scenarios import router as scenarios_router
from .simulations import router as simulations_router
from .comparison import router as comparison_router
from .worker import router as worker_router
from .data_ingestion import router as data_ingestion_router

__all__ = [
    "auth_router",
    "health_router",
    "cities_router",
    "scenarios_router",
    "simulations_router",
    "comparison_router",
    "worker_router",
    "data_ingestion_router",
]
