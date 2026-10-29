"""
backend/simulation/engines/base.py

Abstract base engine interface and standardized data contracts for all simulation engines.
Ensures uniform configuration, result representation, and transparent data provenance.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class EngineType(str, Enum):
    GRAPH_ENGINE = "graph_engine_v1"
    SUMO_ENGINE = "sumo_engine_v1"


class ScenarioType(str, Enum):
    BASELINE = "baseline"
    DEMAND_CHANGE = "demand_change"
    ROAD_CLOSURE = "road_closure"
    SIGNAL_TIMING = "signal_timing"
    INCIDENT = "incident"
    LIVE_INFORMED = "live_informed"


class DemandProfile(str, Enum):
    UNIFORM = "uniform"
    MORNING_PEAK = "morning_peak"
    EVENING_PEAK = "evening_peak"


class DemandConfig(BaseModel):
    """Configuration for synthetic vehicle demand."""
    vehicle_count: int = Field(default=300, ge=1, le=20000, description="Total vehicles to generate")
    duration_seconds: int = Field(default=3600, ge=60, le=86400, description="Simulation duration in seconds")
    start_hour: float = Field(default=8.0, ge=0.0, le=23.99, description="Demand peak center hour")
    demand_profile: DemandProfile = Field(default=DemandProfile.MORNING_PEAK)
    seed: int = Field(default=42, description="Random seed for deterministic reproducibility")


class RoadClosureIntervention(BaseModel):
    """Intervention: completely close one or more road edges."""
    edge_ids: List[str] = Field(default_factory=list, description="IDs of edges to close (e.g. 'u_v_k')")
    description: Optional[str] = "Planned road closure"


class IncidentIntervention(BaseModel):
    """Intervention: temporary incident causing capacity and speed reduction."""
    edge_ids: List[str] = Field(default_factory=list)
    capacity_reduction_factor: float = Field(default=0.5, ge=0.0, le=1.0, description="Remaining capacity ratio")
    speed_reduction_factor: float = Field(default=0.5, ge=0.0, le=1.0, description="Remaining speed ratio")


class SignalTimingIntervention(BaseModel):
    """Intervention: modify traffic signal cycle or split at supported intersections."""
    intersection_node_id: Union[int, str]
    cycle_time_s: float = Field(default=90.0, ge=30.0, le=240.0)
    green_split_ratio: float = Field(default=0.5, ge=0.1, le=0.9)


class ScenarioConfig(BaseModel):
    """Complete specification of a simulation experiment."""
    scenario_id: str = Field(description="Unique scenario identifier")
    scenario_name: str
    scenario_type: ScenarioType = Field(default=ScenarioType.BASELINE)
    city_id: str = "jaipur"
    network_id: str = "jaipur_v1"
    demand: DemandConfig = Field(default_factory=DemandConfig)
    closures: Optional[RoadClosureIntervention] = None
    incidents: Optional[IncidentIntervention] = None
    signals: Optional[SignalTimingIntervention] = None
    description: Optional[str] = ""


class MetricItem(BaseModel):
    """Standardized single metric representation with units and data provenance."""
    value: float
    unit: str
    available: bool = True
    description: str


class VehicleTripRecord(BaseModel):
    """Individual vehicle trip execution summary."""
    vehicle_id: str
    origin_node: str
    destination_node: str
    departure_time_s: float
    arrival_time_s: Optional[float] = None
    travel_time_s: Optional[float] = None
    waiting_time_s: float = 0.0
    distance_m: float = 0.0
    route_node_count: int = 0
    completed: bool = False
    rerouted: bool = False


class EdgeMetricRecord(BaseModel):
    """Aggregated edge performance for map overlays."""
    edge_id: str
    length_m: float
    free_flow_time_s: float
    actual_travel_time_s: float
    volume_veh: int
    capacity_veh_hr: float
    volume_to_capacity_ratio: float
    average_speed_kmh: float
    congested: bool = False
    closed: bool = False


class SimulationMetrics(BaseModel):
    """Comprehensive summary metrics for a simulation run."""
    completed_trips: MetricItem
    avg_travel_time_s: MetricItem
    avg_waiting_time_s: MetricItem
    avg_distance_m: MetricItem
    throughput_veh_per_hr: MetricItem
    active_vehicles: MetricItem
    routing_failures: MetricItem
    simulation_duration_s: MetricItem


class SimulationResult(BaseModel):
    """Full persistent output of an executed simulation run."""
    run_id: str
    scenario_config: ScenarioConfig
    engine_id: str
    engine_version: str
    network_id: str
    seed: int
    status: str = "completed"
    metrics: SimulationMetrics
    edge_metrics: Dict[str, EdgeMetricRecord] = Field(default_factory=dict)
    sample_trips: List[VehicleTripRecord] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    data_label: str = "SIMULATED"
    execution_time_seconds: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ValidationResult(BaseModel):
    """Result of checking scenario feasibility prior to execution."""
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class EngineCapabilities(BaseModel):
    """Exposes capabilities and supported scenarios for an engine."""
    engine_id: str
    name: str
    supported_scenarios: List[ScenarioType]
    supports_lane_changing: bool = False
    supports_signal_timing: bool = False
    supports_queue_spillback: bool = False
    description: str


class SimulationEngine(ABC):
    """Abstract contract required of all Urbynex simulation engines."""

    @property
    @abstractmethod
    def engine_id(self) -> str:
        """Unique engine identifier."""
        pass

    @abstractmethod
    def get_capabilities(self) -> EngineCapabilities:
        """Returns feature support matrix and limitations."""
        pass

    @abstractmethod
    def validate_scenario(self, config: ScenarioConfig) -> ValidationResult:
        """Validates that a scenario is executable on the loaded network."""
        pass

    @abstractmethod
    def run(self, config: ScenarioConfig) -> SimulationResult:
        """Executes the simulation and returns structured, persisted metrics."""
        pass
