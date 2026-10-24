"""
backend/api/routes/scenarios.py

Endpoints for creating, validating, and retrieving traffic simulation scenarios.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from ..dependencies import get_repository, get_simulation_engine
from ..schemas.scenarios import (
    ScenarioCreateRequest,
    ScenarioListResponse,
    ScenarioResponse,
)
from ...db.repository import RunRepository
from ...simulation.engines.base import ScenarioConfig, ScenarioType
from ...simulation.engines.graph_engine import GraphEngine

router = APIRouter(tags=["Scenarios"])


@router.post("/scenarios", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
def create_scenario(
    req: ScenarioCreateRequest,
    repo: RunRepository = Depends(get_repository),
    engine: GraphEngine = Depends(get_simulation_engine),
) -> ScenarioResponse:
    """Creates, validates, and persists a new traffic experiment scenario."""
    scenario_id = f"scen_{uuid.uuid4().hex[:12]}"

    config = ScenarioConfig(
        scenario_id=scenario_id,
        scenario_name=req.name,
        description=req.description,
        city_id=req.city_id,
        network_id=req.network_id,
        scenario_type=req.scenario_type,
        demand=req.demand,
        closures=req.closures,
        incidents=req.incidents,
        signals=req.signals,
    )

    # Validate against actual road network
    validation = engine.validate_scenario(config)
    if not validation.valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scenario validation failed: {'; '.join(validation.errors)}",
        )

    # Persist in DB
    model = repo.save_scenario(config)

    return ScenarioResponse(
        scenario_id=model.scenario_id,
        name=model.name,
        description=model.description,
        city_id=model.city_id,
        network_id=model.network_id,
        scenario_type=model.scenario_type,
        demand=model.demand_json or {},
        interventions=model.interventions_json or {},
        created_at=model.created_at.isoformat() if model.created_at else None,
    )


@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def get_scenario(
    scenario_id: str,
    repo: RunRepository = Depends(get_repository),
) -> ScenarioResponse:
    """Retrieves a scenario definition by ID."""
    model = repo.get_scenario(scenario_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found.",
        )

    return ScenarioResponse(
        scenario_id=model.scenario_id,
        name=model.name,
        description=model.description,
        city_id=model.city_id,
        network_id=model.network_id,
        scenario_type=model.scenario_type,
        demand=model.demand_json or {},
        interventions=model.interventions_json or {},
        created_at=model.created_at.isoformat() if model.created_at else None,
    )


@router.get("/scenarios", response_model=ScenarioListResponse)
def list_scenarios(
    city_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    repo: RunRepository = Depends(get_repository),
) -> ScenarioListResponse:
    """Lists saved scenarios."""
    models = repo.list_scenarios(city_id=city_id, limit=limit)
    items = [
        ScenarioResponse(
            scenario_id=m.scenario_id,
            name=m.name,
            description=m.description,
            city_id=m.city_id,
            network_id=m.network_id,
            scenario_type=m.scenario_type,
            demand=m.demand_json or {},
            interventions=m.interventions_json or {},
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in models
    ]
    return ScenarioListResponse(scenarios=items, total=len(items))
