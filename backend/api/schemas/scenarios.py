"""
backend/api/schemas/scenarios.py

Pydantic schemas for creating and querying traffic scenarios.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from ...simulation.engines.base import (
    DemandConfig,
    IncidentIntervention,
    RoadClosureIntervention,
    ScenarioType,
    SignalTimingIntervention,
)


class ScenarioCreateRequest(BaseModel):
    """Payload to create a new simulation scenario."""
    name: str = Field(min_length=1, max_length=256, description="Human-readable scenario title")
    description: Optional[str] = Field(default="", max_length=2000)
    city_id: str = Field(default="jaipur", description="Target city identifier")
    network_id: str = Field(default="jaipur_v1", description="Target road network version")
    scenario_type: ScenarioType = Field(default=ScenarioType.BASELINE)
    demand: DemandConfig = Field(default_factory=DemandConfig)
    closures: Optional[RoadClosureIntervention] = None
    incidents: Optional[IncidentIntervention] = None
    signals: Optional[SignalTimingIntervention] = None


class ScenarioResponse(BaseModel):
    """Stored scenario representation."""
    scenario_id: str
    name: str
    description: str
    city_id: str
    network_id: str
    scenario_type: str
    demand: Dict[str, Any]
    interventions: Dict[str, Any]
    created_at: Optional[str] = None


class ScenarioListResponse(BaseModel):
    scenarios: List[ScenarioResponse]
    total: int
