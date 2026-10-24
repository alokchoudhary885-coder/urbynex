"""
backend/api/schemas/simulations.py

Pydantic schemas for simulation run triggers, status polling, and metric outputs.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SimulationRunSubmitRequest(BaseModel):
    """Request to submit a simulation run for execution."""
    scenario_id: str = Field(description="Identifier of the scenario to execute")
    engine: str = Field(default="graph_engine_v1", description="Simulation engine identifier")
    seed_override: Optional[int] = Field(default=None, description="Optional random seed override")
    run_async: bool = Field(default=False, description="True for background task; False to wait and return results synchronously")


class SimulationRunStatusResponse(BaseModel):
    """Job status and execution lifecycle metadata."""
    run_id: str
    scenario_id: str
    status: str = Field(description="queued | running | completed | failed | cancelled")
    engine: str
    network_id: str
    seed: int
    submitted_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    execution_time_seconds: Optional[float] = None
    error: Optional[str] = None


class SimulationMetricsResponse(BaseModel):
    """Full metric payload with edge congestion and explicit assumptions."""
    run_id: str
    scenario_id: str
    status: str
    engine: str
    network_id: str
    seed: int
    metrics: Dict[str, Any]
    edge_metrics: Optional[Dict[str, Any]] = None
    sample_trips: Optional[List[Dict[str, Any]]] = None
    assumptions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    data_label: str = "SIMULATED"
    execution_time_seconds: Optional[float] = None
    created_at: Optional[str] = None


class SimulationRunListResponse(BaseModel):
    runs: List[SimulationRunStatusResponse]
    total: int
