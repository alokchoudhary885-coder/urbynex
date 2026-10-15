"""
backend/tests/unit/test_repository.py

Unit tests for RunRepository and SQLite database persistence.
Verifies network metadata upsert, scenario saving, and simulation run persistence.
"""

import pytest
from backend.db.repository import RunRepository
from backend.simulation.network_loader import NetworkLoader
from backend.simulation.engines.base import ScenarioConfig, DemandConfig
from backend.simulation.engines.graph_engine import GraphEngine


@pytest.fixture(scope="module")
def repo():
    RunRepository.init_db()
    return RunRepository()


def test_sync_network_metadata(repo):
    loader = NetworkLoader()
    networks = loader.list_available_networks()
    assert len(networks) > 0

    jaipur_meta = next(n for n in networks if n.get("network_id") == "jaipur_v1")
    model = repo.sync_network_metadata(jaipur_meta)
    assert model.network_id == "jaipur_v1"
    assert model.city_id == "jaipur"
    assert model.node_count == jaipur_meta["node_count"]
    assert model.simulation_ready is True


def test_save_and_retrieve_scenario(repo):
    config = ScenarioConfig(
        scenario_id="repo_scenario_01",
        scenario_name="Repository Test Scenario",
        city_id="jaipur",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=75, duration_seconds=1800, seed=55),
        description="Testing repository persistence",
    )
    saved = repo.save_scenario(config)
    assert saved.scenario_id == "repo_scenario_01"
    assert saved.name == "Repository Test Scenario"

    fetched = repo.get_scenario("repo_scenario_01")
    assert fetched is not None
    assert fetched.demand_json["vehicle_count"] == 75


def test_save_and_query_simulation_run(repo):
    engine = GraphEngine()
    config = ScenarioConfig(
        scenario_id="repo_run_scenario",
        scenario_name="Persisted Run Scenario",
        city_id="jaipur",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=40, duration_seconds=1800, seed=77),
    )
    result = engine.run(config)

    # Persist in DB
    run_model = repo.save_simulation_run(result)
    assert run_model.run_id == result.run_id
    assert run_model.status == "completed"
    assert run_model.completed_trips == result.metrics.completed_trips.value
    assert run_model.avg_travel_time_s == result.metrics.avg_travel_time_s.value

    # Fetch by ID
    queried = repo.get_simulation_run(result.run_id)
    assert queried is not None
    assert queried.run_id == result.run_id
    assert queried.metrics_json["completed_trips"]["value"] == result.metrics.completed_trips.value
    assert len(queried.edge_metrics_json) > 0

    # List runs
    all_runs = repo.list_simulation_runs(limit=10)
    assert len(all_runs) >= 1
    assert any(r.run_id == result.run_id for r in all_runs)
