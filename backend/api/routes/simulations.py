"""
backend/api/routes/simulations.py

Endpoints for triggering simulation runs, polling status, and fetching metric results.
Supports both synchronous runs and background execution.
"""

import time
import uuid
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from ..dependencies import get_repository, get_simulation_engine
from ..schemas.simulations import (
    SimulationMetricsResponse,
    SimulationRunListResponse,
    SimulationRunStatusResponse,
    SimulationRunSubmitRequest,
)
from ..services.simulation_service import SimulationService
from ...db.repository import RunRepository
from ...simulation.engines.graph_engine import GraphEngine

router = APIRouter(tags=["Simulation Runs"])


def get_simulation_service(
    repo: RunRepository = Depends(get_repository),
    engine: GraphEngine = Depends(get_simulation_engine),
) -> SimulationService:
    return SimulationService(repo=repo, engine=engine)


@router.post("/simulations/run", response_model=SimulationRunStatusResponse)
@router.post("/runs", response_model=SimulationRunStatusResponse, include_in_schema=False)
def run_simulation(
    req: SimulationRunSubmitRequest,
    background_tasks: BackgroundTasks,
    service: SimulationService = Depends(get_simulation_service),
    repo: RunRepository = Depends(get_repository),
) -> SimulationRunStatusResponse:
    """
    Submits a simulation run for execution.
    Executes the real GraphEngine (Engine A) and records metrics in SQLite.
    """
    scenario = repo.get_scenario(req.scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{req.scenario_id}' not found.",
        )

    run_id = f"run_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    seed = req.seed_override if req.seed_override is not None else (scenario.demand_json or {}).get("seed", 42)

    if req.run_async:
        # Enqueue background execution (FastAPI background task, modular for Celery in M2.3)
        repo.create_simulation_job(
            run_id=run_id,
            scenario_id=req.scenario_id,
            engine_id=req.engine,
            network_id=scenario.network_id,
            seed=seed,
        )
        background_tasks.add_task(
            service.execute_background_job,
            run_id=run_id,
            scenario_id=req.scenario_id,
            seed_override=req.seed_override,
        )
        return SimulationRunStatusResponse(
            run_id=run_id,
            scenario_id=req.scenario_id,
            status="queued",
            engine=req.engine,
            network_id=scenario.network_id,
            seed=seed,
            submitted_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )
    else:
        # Synchronous execution
        try:
            result = service.run_simulation(
                scenario_id=req.scenario_id,
                engine_id=req.engine,
                seed_override=req.seed_override,
            )
            return SimulationRunStatusResponse(
                run_id=result.run_id,
                scenario_id=req.scenario_id,
                status="completed",
                engine=result.engine_id,
                network_id=result.network_id,
                seed=result.seed,
                submitted_at=result.created_at,
                completed_at=result.created_at,
                execution_time_seconds=result.execution_time_seconds,
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Simulation run failed: {e}",
            )


@router.get("/simulations/{run_id}", response_model=SimulationRunStatusResponse)
@router.get("/runs/{run_id}", response_model=SimulationRunStatusResponse, include_in_schema=False)
def get_simulation_run(
    run_id: str,
    repo: RunRepository = Depends(get_repository),
) -> SimulationRunStatusResponse:
    """Retrieves execution status of a simulation run."""
    model = repo.get_simulation_run(run_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation run '{run_id}' not found.",
        )

    return SimulationRunStatusResponse(
        run_id=model.run_id,
        scenario_id=model.scenario_id,
        status=model.status,
        engine=model.engine_id,
        network_id=model.network_id,
        seed=model.seed,
        completed_at=model.created_at.isoformat() if model.created_at else None,
        execution_time_seconds=model.execution_time_seconds,
        error="; ".join(model.warnings_json) if model.status == "failed" and model.warnings_json else None,
    )


@router.get("/simulations/{run_id}/metrics", response_model=SimulationMetricsResponse)
@router.get("/runs/{run_id}/metrics", response_model=SimulationMetricsResponse, include_in_schema=False)
def get_simulation_metrics(
    run_id: str,
    repo: RunRepository = Depends(get_repository),
) -> SimulationMetricsResponse:
    """Retrieves full simulation metrics and edge-level congestion overlays."""
    model = repo.get_simulation_run(run_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation run '{run_id}' not found.",
        )

    if model.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Simulation run '{run_id}' has status '{model.status}', metrics are not yet available.",
        )

    return SimulationMetricsResponse(
        run_id=model.run_id,
        scenario_id=model.scenario_id,
        status=model.status,
        engine=model.engine_id,
        network_id=model.network_id,
        seed=model.seed,
        metrics=model.metrics_json or {},
        edge_metrics=model.edge_metrics_json,
        sample_trips=model.sample_trips_json,
        assumptions=model.assumptions_json or [],
        warnings=model.warnings_json or [],
        data_label=model.data_label or "SIMULATED",
        execution_time_seconds=model.execution_time_seconds,
        created_at=model.created_at.isoformat() if model.created_at else None,
    )


@router.get("/simulations", response_model=SimulationRunListResponse)
@router.get("/runs", response_model=SimulationRunListResponse, include_in_schema=False)
def list_simulation_runs(
    limit: int = Query(default=50, ge=1, le=200),
    repo: RunRepository = Depends(get_repository),
) -> SimulationRunListResponse:
    """Lists recent simulation runs."""
    models = repo.list_simulation_runs(limit=limit)
    items = [
        SimulationRunStatusResponse(
            run_id=m.run_id,
            scenario_id=m.scenario_id,
            status=m.status,
            engine=m.engine_id,
            network_id=m.network_id,
            seed=m.seed,
            completed_at=m.created_at.isoformat() if m.created_at else None,
            execution_time_seconds=m.execution_time_seconds,
        )
        for m in models
    ]
    return SimulationRunListResponse(runs=items, total=len(items))
