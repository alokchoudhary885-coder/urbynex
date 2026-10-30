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


class MonteCarloRunRequest(BaseModel):
    """Request to execute a multi-seed Monte Carlo batch for statistical confidence."""
    scenario_id: str = Field(description="Scenario identifier to evaluate")
    seeds: List[int] = Field(
        default=[42, 101, 202, 303, 404],
        min_length=2,
        max_length=20,
        description="List of RNG seeds to sample",
    )
    engine: str = Field(default="graph_engine_v1", description="Simulation engine identifier")


class MonteCarloMetricSummary(BaseModel):
    """Aggregated statistical distribution for a single simulation metric."""
    metric_name: str
    unit: str
    mean: float
    std_dev: float
    min_value: float
    max_value: float
    ci_95_lower: float
    ci_95_upper: float


class MonteCarloResponse(BaseModel):
    """Statistical summary of multi-seed Monte Carlo batch execution."""
    scenario_id: str
    seed_count: int
    seeds: List[int]
    metrics_summary: Dict[str, MonteCarloMetricSummary]
    individual_run_ids: List[str]
    total_execution_time_seconds: float
