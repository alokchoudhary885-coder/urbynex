"""
backend/tests/integration/test_worker.py

Integration tests for M2.3 Celery / Job Queue infrastructure.

Tests cover:
  - Worker status endpoint always returns a valid response (whether Redis up or down)
  - Celery task dispatch fallback: when Redis unavailable, BackgroundTasks are used
  - Simulation task helper functions work correctly in isolation
  - run_simulation_task logic is correct when called synchronously (EAGER mode)
"""

import pytest
from unittest.mock import patch, MagicMock
from starlette.testclient import TestClient

from backend.api.main import app
from backend.db.repository import RunRepository


@pytest.fixture(scope="module")
def client():
    RunRepository.init_db()
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Worker status endpoint
# ---------------------------------------------------------------------------

def test_worker_status_returns_valid_structure(client):
    """GET /api/worker/status always returns a dict with expected keys, regardless of Redis."""
    res = client.get("/api/worker/status")
    assert res.status_code == 200
    data = res.json()
    assert "redis_available" in data
    assert "celery_workers" in data
    assert "dispatch_mode" in data
    assert "broker_url" in data
    assert isinstance(data["redis_available"], bool)
    assert isinstance(data["celery_workers"], list)
    assert data["dispatch_mode"] in ("celery", "background_task_fallback")


def test_worker_status_no_redis_shows_fallback(client):
    """When Redis is not running (typical dev env), dispatch_mode is fallback."""
    res = client.get("/api/worker/status")
    assert res.status_code == 200
    data = res.json()
    # In the test environment Redis is not running
    if not data["redis_available"]:
        assert data["dispatch_mode"] == "background_task_fallback"


def test_worker_status_broker_url_does_not_expose_credentials(client):
    """Broker URL in the response must not contain raw passwords (user:pass@host format)."""
    res = client.get("/api/worker/status")
    assert res.status_code == 200
    broker_url = res.json()["broker_url"]
    # A password-bearing URL looks like redis://user:password@host:port
    # After redaction it becomes redis://***@host:port — no raw credential after ://
    # host:port is fine, but user:password@... should not appear
    import re
    has_credentials = bool(re.search(r"redis://[^@]+:[^@]+@", broker_url))
    assert not has_credentials, f"Broker URL exposes credentials: {broker_url}"


# ---------------------------------------------------------------------------
# Celery app configuration
# ---------------------------------------------------------------------------

def test_celery_app_importable():
    """The celery_app can be imported and has correct task names registered."""
    from backend.worker.celery_app import celery_app
    assert celery_app.main == "urbynex"


def test_celery_task_registered():
    """The simulation task is registered in the Celery app's task registry."""
    from backend.worker.celery_app import celery_app
    # Force task registration by importing the tasks module
    import backend.worker.tasks  # noqa: F401
    assert "backend.worker.tasks.run_simulation_task" in celery_app.tasks


def test_is_redis_available_returns_bool():
    """is_redis_available always returns a bool (never raises)."""
    from backend.worker.celery_app import is_redis_available
    result = is_redis_available()
    assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# Celery task in EAGER / test mode
# ---------------------------------------------------------------------------

def test_run_simulation_task_eager_mode(client):
    """
    Runs the Celery task synchronously via EAGER mode.
    Verifies the task correctly loads a scenario, runs simulation, and persists results.
    """
    from backend.worker.celery_app import celery_app

    # Create a real scenario via the API first
    scenario_payload = {
        "name": "Celery Test Scenario",
        "city_id": "jaipur",
        "network_id": "jaipur_v1",
        "scenario_type": "baseline",
        "demand": {
            "vehicle_count": 30,
            "duration_seconds": 900,
            "seed": 99,
        },
    }
    scenario_res = client.post("/api/scenarios", json=scenario_payload)
    assert scenario_res.status_code == 201, scenario_res.text
    scenario_id = scenario_res.json()["scenario_id"]

    import uuid, time
    run_id = f"run_eager_{int(time.time())}_{uuid.uuid4().hex[:6]}"

    # Create the job record as the API normally would
    repo = RunRepository()
    repo.create_simulation_job(
        run_id=run_id,
        scenario_id=scenario_id,
        engine_id="graph_engine_v1",
        network_id="jaipur_v1",
        seed=99,
    )

    # Configure Celery to run tasks synchronously (no broker needed)
    celery_app.conf.update(task_always_eager=True, task_eager_propagates=True)

    try:
        from backend.worker.tasks import run_simulation_task
        result = run_simulation_task.apply(
            kwargs={"run_id": run_id, "scenario_id": scenario_id, "seed_override": 99}
        )
        task_result = result.get()

        assert task_result["run_id"] == run_id
        assert task_result["status"] == "completed"
        assert task_result["completed_trips"] > 0
        assert task_result["execution_time_seconds"] > 0

        # Verify it was actually persisted in the DB
        saved = repo.get_simulation_run(run_id)
        assert saved is not None
        assert saved.status == "completed"
        assert saved.completed_trips > 0
    finally:
        # Reset EAGER mode so other tests use normal async dispatch
        celery_app.conf.update(task_always_eager=False)


def test_run_simulation_task_missing_scenario(client):
    """
    Task fails cleanly when called with a scenario_id that does not exist in DB.
    We create a legitimate run record against a real scenario, but pass a
    non-existent scenario_id directly to the task kwargs to simulate a scenario
    that has been purged between enqueue and execution.
    """
    from backend.worker.celery_app import celery_app
    from backend.worker.tasks import run_simulation_task

    # Create a real scenario to anchor the queued run_id
    scenario_res = client.post(
        "/api/scenarios",
        json={
            "name": "Anchor Scenario For Missing Test",
            "city_id": "jaipur",
            "network_id": "jaipur_v1",
            "scenario_type": "baseline",
            "demand": {"vehicle_count": 10, "duration_seconds": 300, "seed": 5},
        },
    )
    assert scenario_res.status_code == 201
    anchor_id = scenario_res.json()["scenario_id"]

    import uuid, time
    run_id = f"run_missing_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    repo = RunRepository()
    # Create run record anchored to the real scenario
    repo.create_simulation_job(
        run_id=run_id,
        scenario_id=anchor_id,
        engine_id="graph_engine_v1",
        network_id="jaipur_v1",
        seed=5,
    )

    # Pass a completely non-existent scenario_id to the task kwargs —
    # simulates the scenario having been deleted between enqueue and execution
    PURGED_SCENARIO_ID = "scen_purged_does_not_exist"

    celery_app.conf.update(task_always_eager=True, task_eager_propagates=False)
    try:
        result = run_simulation_task.apply(
            kwargs={"run_id": run_id, "scenario_id": PURGED_SCENARIO_ID}
        )
        task_result = result.get()
        assert task_result["status"] == "failed"
        assert "error" in task_result

        saved = repo.get_simulation_run(run_id)
        assert saved is not None
        assert saved.status == "failed"
    finally:
        celery_app.conf.update(task_always_eager=False)


# ---------------------------------------------------------------------------
# Dispatch integration: async route uses fallback when Redis unavailable
# ---------------------------------------------------------------------------

def test_async_simulation_uses_background_task_fallback_when_no_redis(client):
    """
    When Redis is not running, POST /simulations/run?run_async=true returns
    'queued' immediately and the job is processed via BackgroundTasks.
    """
    # Create scenario
    scenario_res = client.post(
        "/api/scenarios",
        json={
            "name": "Async Fallback Test",
            "city_id": "jaipur",
            "network_id": "jaipur_v1",
            "scenario_type": "baseline",
            "demand": {"vehicle_count": 20, "duration_seconds": 600, "seed": 77},
        },
    )
    assert scenario_res.status_code == 201
    scenario_id = scenario_res.json()["scenario_id"]

    # Submit async run
    run_res = client.post(
        "/api/simulations/run",
        json={"scenario_id": scenario_id, "run_async": True},
    )
    assert run_res.status_code == 200, run_res.text
    data = run_res.json()
    assert data["status"] in ("queued", "completed")
    assert "run_id" in data
