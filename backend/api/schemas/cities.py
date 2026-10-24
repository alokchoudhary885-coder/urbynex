"""
backend/api/schemas/cities.py

Pydantic schemas for cities, road networks, and edge summaries.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CityResponse(BaseModel):
    """City summary information."""
    city_id: str
    name: str
    country: str = "India"
    status: str = Field(description="network_ready | planned | importing | validation_failed")
    networks_available: int
    description: str


class CityListResponse(BaseModel):
    cities: List[CityResponse]


class NetworkResponse(BaseModel):
    """Detailed road network metadata."""
    network_id: str
    city_id: str
    version: str = "v1"
    description: str
    bbox: Dict[str, float]
    node_count: int
    edge_count: int
    total_road_length_km: float
    source: str = "OpenStreetMap contributors"
    license: str = "Open Database License (ODbL) 1.0"
    imported_at: Optional[str] = None
    validation_status: str
    simulation_ready: bool
    sha256_hash: Optional[str] = None


class NetworkListResponse(BaseModel):
    networks: List[NetworkResponse]


class EdgeSummary(BaseModel):
    """Summary of a specific edge in the road network."""
    edge_id: str
    name: str
    highway: str
    length_m: float
    speed_kmh: float
    lanes: int
    capacity_veh_hr: float
    free_flow_time_s: float


class EdgeListResponse(BaseModel):
    edges: List[EdgeSummary]
    total: int
