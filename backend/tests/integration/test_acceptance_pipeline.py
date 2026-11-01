"""
backend/tests/integration/test_acceptance_pipeline.py

M7.1 & M7.5: Final Platform End-to-End Acceptance Test Suite.
Validates the complete production lifecycle:
  1. Multi-City Network Verification (Jaipur + Delhi)
  2. Authentication & Authorization Lifecycle (Register, Login, Token, Profile)
  3. Scenario Engineering Studio (Interventions: Closures, Incidents, Demand)
  4. Simulation Execution (BPR link performance + Webster signal delay)
  5. Scenario Comparison Engine (Baseline vs Intervention Delta calculation)
  6. Stochastic Monte Carlo Batch Engine (Confidence Interval generation)
  7. AI Copilot RAG Groundedness (Document citations & zero-fabrication safety)
  8. Data Ingestion & Live Provider Auditing (Zero-fabrication disclosure)
"""

import pytest
from starlette.testclient import TestClient
from backend.api.main import app

client = TestClient(app)


def test_e2e_acceptance_multi_city_networks():
    """Verify both Jaipur and Delhi networks are ingested, validated and simulation-ready."""
    res = client.get("/api/cities")
    assert res.status_code == 200
    cities = res.json()["cities"]
    city_ids = {c["city_id"] for c in cities}
    assert "jaipur" in city_ids
    assert "delhi" in city_ids

    # Check network details for Jaipur
    res_jaipur_net = client.get("/api/cities/jaipur/networks")
    assert res_jaipur_net.status_code == 200
    jaipur_networks = res_jaipur_net.json()["networks"]
    assert any(n["network_id"] == "jaipur_v1" for n in jaipur_networks)

    # Check network details for Delhi
    res_delhi_net = client.get("/api/cities/delhi/networks")
    assert res_delhi_net.status_code == 200
    delhi_networks = res_delhi_net.json()["networks"]
    delhi_net = next(n for n in delhi_networks if n["network_id"] == "delhi_v1")
    assert delhi_net["node_count"] > 2000
    assert delhi_net["edge_count"] > 4000
    assert delhi_net["simulation_ready"] is True


def test_e2e_acceptance_auth_lifecycle():
    """Verify registration, login, JWT token generation, and authorized me endpoint."""
    user_payload = {
        "email": "e2e_planner@urbynex.io",
        "password": "SecurePassword987!",
        "name": "E2E Senior Planner",
    }
    # Register
    reg_res = client.post("/api/auth/register", json=user_payload)
    assert reg_res.status_code in (201, 400, 409)  # 409 if already exists in persistent db

    # Login
    login_res = client.post(
        "/api/auth/login",
        json={"email": user_payload["email"], "password": user_payload["password"]},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    token = token_data["access_token"]
    assert token is not None

    # Get profile
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == user_payload["email"]


def test_e2e_acceptance_simulation_and_comparison_pipeline():
    """
    Run full simulation loop:
      - Create baseline scenario
      - Create road closure scenario
      - Run both simulations
      - Compare metrics side-by-side
    """
    # 1. Baseline scenario
    baseline_payload = {
        "name": "E2E Acceptance Baseline",
        "city_id": "jaipur",
        "network_id": "jaipur_v1",
        "scenario_type": "baseline",
        "demand": {
            "vehicle_count": 200,
            "duration_seconds": 3600,
            "seed": 42,
        },
    }
    res_sc_base = client.post("/api/scenarios", json=baseline_payload)
    assert res_sc_base.status_code == 201
    base_sc_id = res_sc_base.json()["scenario_id"]

    # 2. Road closure scenario (close first edge in network)
    closure_payload = {
        "name": "E2E Acceptance Road Closure",
        "city_id": "jaipur",
        "network_id": "jaipur_v1",
        "scenario_type": "road_closure",
        "demand": {
            "vehicle_count": 200,
            "duration_seconds": 3600,
            "seed": 42,
        },
        "closures": {
            "edge_ids": ["316823908"],
            "description": "Emergency construction on MI Road corridor",
        },
    }
    res_sc_close = client.post("/api/scenarios", json=closure_payload)
    assert res_sc_close.status_code == 201
    close_sc_id = res_sc_close.json()["scenario_id"]

    # 3. Execute Baseline run
    run_base_res = client.post(
        "/api/simulations/run",
        json={"scenario_id": base_sc_id, "run_async": False, "seed_override": 42},
    )
    assert run_base_res.status_code == 200
    base_run_id = run_base_res.json()["run_id"]

    # 4. Execute Road closure run
    run_close_res = client.post(
        "/api/simulations/run",
        json={"scenario_id": close_sc_id, "run_async": False, "seed_override": 42},
    )
    assert run_close_res.status_code == 200
    close_run_id = run_close_res.json()["run_id"]

    # 5. Compare baseline vs closure
    compare_res = client.post(
        "/api/compare",
        json={"baseline_run_id": base_run_id, "target_run_id": close_run_id},
    )
    assert compare_res.status_code == 200
    comp = compare_res.json()
    assert comp["compatible"] is True
    assert "metrics" in comp
    assert len(comp["metrics"]) > 0
    assert "summary_verdict" in comp


def test_e2e_acceptance_monte_carlo_batch():
    """Verify stochastic batch simulation generates valid confidence intervals."""
    # Create scenario
    sc_res = client.post(
        "/api/scenarios",
        json={
            "name": "E2E Monte Carlo Scenario",
            "city_id": "jaipur",
            "network_id": "jaipur_v1",
            "scenario_type": "baseline",
            "demand": {"vehicle_count": 100, "duration_seconds": 1800},
        },
    )
    assert sc_res.status_code == 201
    sc_id = sc_res.json()["scenario_id"]

    # Run 3 seeds
    mc_res = client.post(
        "/api/simulations/monte-carlo",
        json={"scenario_id": sc_id, "seeds": [101, 102, 103]},
    )
    assert mc_res.status_code == 200
    mc = mc_res.json()
    assert mc["seed_count"] == 3
    assert len(mc["individual_run_ids"]) == 3
    # Check that travel time summary exists with CI
    tt = mc["metrics_summary"].get("avg_travel_time_s")
    assert tt is not None
    assert tt["mean"] > 0
    assert tt["ci_95_lower"] <= tt["ci_95_upper"]


def test_e2e_acceptance_ai_copilot_groundedness():
    """Verify AI copilot cites real planning documents and denies ungrounded queries."""
    # 1. Grounded query about Delhi Master Plan
    res_delhi = client.post(
        "/api/ai/chat",
        json={"query": "What are the transit goals in the Delhi Master Plan 2041?", "city_id": "delhi"},
    )
    assert res_delhi.status_code == 200
    data_delhi = res_delhi.json()
    assert data_delhi["data_label"] == "CITED_DOCUMENT"
    assert len(data_delhi["citations"]) > 0

    # 2. Grounded query about Jaipur CMP
    res_jaipur = client.post(
        "/api/ai/chat",
        json={"query": "What does the Jaipur CMP say about MI Road?", "city_id": "jaipur"},
    )
    assert res_jaipur.status_code == 200
    data_jaipur = res_jaipur.json()
    assert data_jaipur["data_label"] == "CITED_DOCUMENT"

    # 3. Completely ungrounded query (zero-fabrication safety fallback)
    res_mars = client.post(
        "/api/ai/chat",
        json={"query": "What is the weather on Mars today?"},
    )
    assert res_mars.status_code == 200
    data_mars = res_mars.json()
    assert "sufficient evidence" in data_mars["answer"].lower()


def test_e2e_acceptance_data_governance():
    """Verify live provider zero-fabrication reporting and historical dataset quality audit."""
    # Live providers
    live_res = client.get("/api/data/live/status")
    assert live_res.status_code == 200
    providers = live_res.json()["providers"]
    assert len(providers) >= 2
    # Check that providers report real credential status
    for p in providers:
        assert p["status"] in ("live", "credentials_missing", "error")

    # Historical CSV upload
    csv_sample = (
        "timestamp,edge_id,speed_kmh,volume_veh_per_hr\n"
        "2026-10-31T08:00:00+05:30,316823908,40.0,1500\n"
        "2026-10-31T08:00:00+05:30,316823910,35.0,2000\n"
    )
    upload_res = client.post(
        "/api/data/historical/upload?network_id=jaipur_v1&format=csv&source_name=e2e_audit",
        content=csv_sample.encode("utf-8"),
        headers={"Content-Type": "text/csv"},
    )
    assert upload_res.status_code == 200
    report = upload_res.json()
    assert report["quality_report"]["valid_rows"] == 2
    assert report["quality_report"]["completeness_pct"] == 100.0
