"""
backend/api/dependencies.py

FastAPI dependency injection providers for database sessions,
repositories, network loaders, and simulation engines.
"""

from typing import Generator
from fastapi import Depends
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..db.repository import RunRepository
from ..simulation.network_loader import NetworkLoader
from ..simulation.engines.graph_engine import GraphEngine


def get_repository(db: Session = Depends(get_db)) -> RunRepository:
    """Provides a RunRepository instance with the active database session."""
    return RunRepository(db=db)


def get_network_loader() -> NetworkLoader:
    """Provides a NetworkLoader instance pointing to the data/networks directory."""
    return NetworkLoader()


def get_simulation_engine(loader: NetworkLoader = Depends(get_network_loader)) -> GraphEngine:
    """Provides an initialized GraphEngine instance."""
    return GraphEngine(network_loader=loader)
