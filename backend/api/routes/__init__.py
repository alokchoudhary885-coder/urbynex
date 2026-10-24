"""Urbynex API Routes Package"""
from .health import router as health_router
from .cities import router as cities_router
from .scenarios import router as scenarios_router
from .simulations import router as simulations_router
from .comparison import router as comparison_router

__all__ = [
    "health_router",
    "cities_router",
    "scenarios_router",
    "simulations_router",
    "comparison_router",
]
