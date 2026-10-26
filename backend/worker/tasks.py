"""
backend/worker/tasks.py

Celery task definitions for Urbynex background job execution.

Each task:
  1. Updates the job status to 'running' at the start
  2. Executes the real simulation engine
  3. Persists the full result to SQLite
  4. Updates status to 'completed' or 'failed'

Callers (the simulation API route) use `run_simulation_task.apply_async()`
when Redis is available, or fall back to FastAPI BackgroundTasks otherwise.
"""

import logging
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from .celery_app import celery_app, task_logger
from ..db.repository import RunRepository
from ..db.session import SessionLocal
from ..simulation.engines.graph_engine import GraphEngine
from ..simulation.network_loader import NetworkLoader
from ..simulation.engines.base import (
    DemandConfig,
    RoadClosureIntervention,
    IncidentIntervention,
    ScenarioConfig,
    ScenarioType,
)

logger = logging.getLogger("urbynex.tasks")


def _build_scenario_config_from_db(scenario_model) -> ScenarioConfig:
    """
    Reconstructs a ScenarioConfig from a persisted ScenarioModel.
    The demand and interventions are stored as JSON blobs.
    """
    demand_data = scenario_model.demand_json or {}
    demand = DemandConfig(
        vehicle_count=demand_data.get("vehicle_count", 100),
        duration_seconds=demand_data.get("duration_seconds", 3600),
        seed=demand_data.get("seed", 42),
        demand_profile=demand_data.get("demand_profile", "uniform"),
    )

    interventions = scenario_model.interventions_json or {}

    closures = None
    if interventions.get("closures"):
        c = interventions["closures"]
        closures = RoadClosureIntervention(
            edge_ids=c.get("edge_ids", []),
            description=c.get("description", c.get("reason", "Planned road closure")),
        )

    incidents = None
    if interventions.get("incidents"):
        i = interventions["incidents"]
        incidents = IncidentIntervention(
            edge_ids=i.get("edge_ids", []),
            capacity_reduction_factor=i.get("capacity_reduction_factor", 0.5),
            speed_reduction_factor=i.get("speed_reduction_factor", 0.5),
        )

    return ScenarioConfig(
        scenario_id=scenario_model.scenario_id,
        scenario_name=scenario_model.name,
        description=scenario_model.description,
        city_id=scenario_model.city_id,
        network_id=scenario_model.network_id,
        scenario_type=ScenarioType(scenario_model.scenario_type),
        demand=demand,
        closures=closures,
        incidents=incidents,
    )


@celery_app.task(
    bind=True,
    name="backend.worker.tasks.run_simulation_task",
    max_retries=2,
    default_retry_delay=10,
    acks_late=True,
)
def run_simulation_task(
    self: Task,
    run_id: str,
    scenario_id: str,
    seed_override: int | None = None,
) -> dict:
    """
    Background Celery task: load scenario from DB, run simulation, persist result.

    Args:
        run_id:        Pre-generated run identifier (created before task is enqueued).
        scenario_id:   Scenario to simulate (must already exist in DB).
        seed_override: Optional RNG seed; overrides the scenario's stored seed.

    Returns:
        dict with run_id, status, and key scalar metrics on success.

    Raises:
        Retries on transient errors; marks as 'failed' after max_retries exceeded.
    """
    repo = RunRepository()
    task_logger.info(f"[{run_id}] Starting simulation task for scenario={scenario_id}")

    # Mark job as running
    repo.update_run_status(run_id, "running")

    try:
        # Load scenario from DB
        scenario_model = repo.get_scenario(scenario_id)
        if scenario_model is None:
            raise ValueError(f"Scenario '{scenario_id}' not found in database.")

        # Build ScenarioConfig
        config = _build_scenario_config_from_db(scenario_model)

        # Apply optional seed override
        if seed_override is not None:
            config.demand.seed = seed_override

        # Execute real simulation engine
        engine = GraphEngine(network_loader=NetworkLoader())
        result = engine.run(config)

        # Persist full result (overwrites the skeleton queued record)
        db = SessionLocal()
        try:
            from ..db.models import SimulationRunModel

            # Delete the queued skeleton so save_simulation_run can INSERT cleanly
            existing = db.query(SimulationRunModel).filter_by(run_id=run_id).first()
            if existing:
                db.delete(existing)
                db.commit()
        finally:
            db.close()

        # Assign the pre-generated run_id to the result
        result.run_id = run_id
        saved = repo.save_simulation_run(result)

        task_logger.info(
            f"[{run_id}] Simulation completed: "
            f"trips={saved.completed_trips}, "
            f"avg_tt={saved.avg_travel_time_s:.1f}s, "
            f"exec_time={saved.execution_time_seconds:.2f}s"
        )

        return {
            "run_id": run_id,
            "status": "completed",
            "completed_trips": saved.completed_trips,
            "avg_travel_time_s": saved.avg_travel_time_s,
            "execution_time_seconds": saved.execution_time_seconds,
        }

    except SoftTimeLimitExceeded:
        task_logger.error(f"[{run_id}] Soft time limit exceeded — marking failed.")
        repo.update_run_status(run_id, "failed", "Task exceeded soft time limit (300s).")
        raise  # Let Celery handle the hard limit

    except Exception as exc:
        task_logger.error(f"[{run_id}] Simulation failed: {exc}", exc_info=True)

        # Retry on transient errors (network I/O, DB lock, etc.)
        if self.request.retries < self.max_retries:
            task_logger.info(f"[{run_id}] Retrying (attempt {self.request.retries + 1})...")
            repo.update_run_status(run_id, "queued", f"Retry {self.request.retries + 1}: {exc}")
            raise self.retry(exc=exc, countdown=self.default_retry_delay)

        # Max retries exceeded — mark permanently failed
        repo.update_run_status(run_id, "failed", str(exc))
        return {
            "run_id": run_id,
            "status": "failed",
            "error": str(exc),
        }
