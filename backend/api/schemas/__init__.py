"""Urbynex API Schemas Package"""
from .auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse, CurrentUser
from .common import ErrorResponse, HealthResponse
from .cities import CityResponse, CityListResponse, NetworkResponse, NetworkListResponse, EdgeSummary, EdgeListResponse
from .scenarios import ScenarioCreateRequest, ScenarioResponse, ScenarioListResponse
from .simulations import SimulationRunSubmitRequest, SimulationRunStatusResponse, SimulationMetricsResponse, SimulationRunListResponse
from .comparison import ComparisonRequest, ComparisonResponse

__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "UserResponse",
    "CurrentUser",
    "ErrorResponse",
    "HealthResponse",
    "CityResponse",
    "CityListResponse",
    "NetworkResponse",
    "NetworkListResponse",
    "EdgeSummary",
    "EdgeListResponse",
    "ScenarioCreateRequest",
    "ScenarioResponse",
    "ScenarioListResponse",
    "SimulationRunSubmitRequest",
    "SimulationRunStatusResponse",
    "SimulationMetricsResponse",
    "SimulationRunListResponse",
    "ComparisonRequest",
    "ComparisonResponse",
]
