"""
backend/tests/integration/test_api.py

Comprehensive integration test suite for the Urbynex FastAPI REST API.
Verifies all M2.1 endpoints against the real database and simulation engine.
"""

import pytest
from starlette.testclient import TestClient
from backend.api.main import app
from backend.db.repository import RunRepository


@pytest.fixture(scope="module")
def client():
    # Initialize DB and sync networks
    RunRepository.init_db()
    with TestClient(app) as c:
        yield c


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Urbynex Smart City Digital Twin API"
    assert "jaipur" in data["supported_cities"]


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


def test_list_cities(client):
    response = client.get("/api/cities")
    assert response.status_code == 200
    data = response.json()
    assert "cities" in data
    assert len(data["cities"]) >= 1

    jaipur = next((c for c in data["cities"] if c["city_id"] == "jaipur"), None)
    assert jaipur is not None
    assert jaipur["name"] == "Jaipur"
    assert jaipur["status"] == "network_ready"
    assert jaipur["networks_available"] >= 1


def test_list_city_networks(client):
    response = client.get("/api/cities/jaipur/networks")
    assert response.status_code == 200
    data = response.json()
    assert "networks" in data
    assert len(data["networks"]) >= 1

    net = data["networks"][0]
    assert net["network_id"] == "jaipur_v1"
    assert net["city_id"] == "jaipur"
    assert net["simulation_ready"] is True
    assert net["node_count"] > 1000
    assert net["edge_count"] > 2000


def test_get_network_geojson(client):
    response = client.get("/api/networks/jaipur_v1/geojson")
    assert response.status_code == 200
    assert "application/geo+json" in response.headers.get("content-type", "")

    geojson = response.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) > 1000
    first_feat = geojson["features"][0]
    assert "geometry" in first_feat
    assert "properties" in first_feat
    assert "edge_id" in first_feat["properties"]


def test_get_network_edges(client):
    response = client.get("/api/cities/jaipur/networks/jaipur_v1/edges?limit=25")
    assert response.status_code == 200
    data = response.json()
    assert "edges" in data
    assert len(data["edges"]) == 25
    assert data["total"] > 2000

    first_edge = data["edges"][0]
    assert "edge_id" in first_edge
    assert "length_m" in first_edge
    assert "speed_kmh" in first_edge


def test_create_and_get_scenario(client):
    payload = {
        "name": "Integration Test Scenario",
        "description": "Created during integration testing",
        "city_id": "jaipur",
        "network_id": "jaipur_v1",
        "scenario_type": "baseline",
        "demand": {
            "vehicle_count": 45,
            "duration_seconds": 1800,
            "demand_profile": "morning_peak",
            "seed": 42,
        },
    }
    # Create scenario
    res_create = client.post("/api/scenarios", json=payload)
    assert res_create.status_code == 201
    scen_data = res_create.json()
    assert "scenario_id" in scen_data
    scen_id = scen_data["scenario_id"]
    assert scen_data["name"] == "Integration Test Scenario"

    # Retrieve scenario
    res_get = client.get(f"/api/scenarios/{scen_id}")
    assert res_get.status_code == 200
    assert res_get.json()["scenario_id"] == scen_id


def test_create_scenario_validation_failure(client):
    # Invalid vehicle_count (0)
    payload = {
        "name": "Bad Scenario",
        "city_id": "jaipur",
        "network_id": "jaipur_v1",
        "demand": {
            "vehicle_count": 0,
        },
    }
    response = client.post("/api/scenarios", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "validation_error"


def test_run_simulation_synchronously(client):
    # 1. Create a test scenario
    scen_res = client.post(
        "/api/scenarios",
        json={
            "name": "Sync Simulation Test",
            "city_id": "jaipur",
            "network_id": "jaipur_v1",
            "scenario_type": "baseline",
            "demand": {
                "vehicle_count": 30,
                "duration_seconds": 1800,
                "seed": 101,
            },
        },
    )
    assert scen_res.status_code == 201
    scen_id = scen_res.json()["scenario_id"]

    # 2. Trigger synchronous simulation execution
    run_res = client.post(
        "/api/simulations/run",
        json={
            "scenario_id": scen_id,
            "engine": "graph_engine_v1",
            "run_async": False,
        },
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["status"] == "completed"
    run_id = run_data["run_id"]

    # 3. Retrieve status
    status_res = client.get(f"/api/simulations/{run_id}")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "completed"

    # 4. Retrieve metrics
    metrics_res = client.get(f"/api/simulations/{run_id}/metrics")
    assert metrics_res.status_code == 200
    m_data = metrics_res.json()
    assert m_data["status"] == "completed"
    assert m_data["metrics"]["completed_trips"]["value"] > 0
    assert m_data["metrics"]["avg_travel_time_s"]["value"] > 0
    assert m_data["data_label"] == "SIMULATED"
    assert len(m_data["assumptions"]) > 0


def test_run_simulation_asynchronously(client):
    # Create scenario
    scen_res = client.post(
        "/api/scenarios",
        json={
            "name": "Async Simulation Test",
            "city_id": "jaipur",
            "network_id": "jaipur_v1",
            "scenario_type": "baseline",
            "demand": {
                "vehicle_count": 25,
                "duration_seconds": 1800,
                "seed": 202,
            },
        },
    )
    scen_id = scen_res.json()["scenario_id"]

    # Trigger with run_async=True
    run_res = client.post(
        "/api/simulations/run",
        json={
            "scenario_id": scen_id,
            "engine": "graph_engine_v1",
            "run_async": True,
        },
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["status"] in ("queued", "running", "completed")


def test_compare_simulation_runs_endpoint(client):
    # 1. Create baseline scenario (40 vehicles)
    base_scen = client.post(
        "/api/scenarios",
        json={
            "name": "Compare Baseline",
            "city_id": "jaipur",
            "network_id": "jaipur_v1",
            "scenario_type": "baseline",
            "demand": {"vehicle_count": 40, "duration_seconds": 1800, "seed": 500},
        },
    ).json()["scenario_id"]

    # 2. Create high demand scenario (80 vehicles)
    high_scen = client.post(
        "/api/scenarios",
        json={
            "name": "Compare High Demand",
            "city_id": "jaipur",
            "network_id": "jaipur_v1",
            "scenario_type": "demand_change",
            "demand": {"vehicle_count": 80, "duration_seconds": 1800, "seed": 500},
        },
    ).json()["scenario_id"]

    # 3. Run both synchronously
    base_res = client.post("/api/simulations/run", json={"scenario_id": base_scen, "run_async": False})
    assert base_res.status_code == 200, f"Baseline run failed: {base_res.text}"
    base_run_id = base_res.json()["run_id"]

    high_res = client.post("/api/simulations/run", json={"scenario_id": high_scen, "run_async": False})
    assert high_res.status_code == 200, f"High-demand run failed: {high_res.text}"
    high_run_id = high_res.json()["run_id"]

    # 4. Compare runs via API
    cmp_res = client.post(
        "/api/compare",
        json={
            "baseline_run_id": base_run_id,
            "target_run_id": high_run_id,
        },
    )
    assert cmp_res.status_code == 200
    cmp_data = cmp_res.json()
    assert cmp_data["compatible"] is True
    assert len(cmp_data["metrics"]) >= 6
    assert len(cmp_data["summary_verdict"]) > 0

    # Verify deltas
    tt_metric = next(m for m in cmp_data["metrics"] if m["metric_name"] == "avg_travel_time_s")
    assert "baseline_value" in tt_metric
    assert "target_value" in tt_metric
    assert "absolute_diff" in tt_metric
    assert "direction" in tt_metric


def test_error_handling_not_found(client):
    # Nonexistent city networks
    res_city = client.get("/api/cities/non_existent_city/networks")
    assert res_city.status_code == 404
    assert res_city.json()["error"] == "not_found"

    # Nonexistent simulation run
    res_run = client.get("/api/simulations/run_fake_12345")
    assert res_run.status_code == 404
    assert res_run.json()["error"] == "not_found"
