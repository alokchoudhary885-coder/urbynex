"""
backend/tests/unit/test_graph_engine.py

Unit tests and deterministic verification for GraphEngine (Engine A).
Tests reproducibility, demand scaling, road closure rerouting, and metric accuracy.
"""

import pytest
from backend.simulation.engines.base import (
    DemandConfig,
    DemandProfile,
    RoadClosureIntervention,
    SignalTimingIntervention,
    IncidentIntervention,
    ScenarioConfig,
    ScenarioType,
)
from backend.simulation.engines.graph_engine import GraphEngine
from backend.simulation.network_loader import NetworkLoader


@pytest.fixture
def engine():
    return GraphEngine()


def test_engine_capabilities(engine):
    caps = engine.get_capabilities()
    assert caps.engine_id == "graph_engine_v1"
    assert ScenarioType.BASELINE in caps.supported_scenarios
    assert ScenarioType.ROAD_CLOSURE in caps.supported_scenarios
    assert ScenarioType.DEMAND_CHANGE in caps.supported_scenarios


def test_scenario_validation_valid(engine):
    config = ScenarioConfig(
        scenario_id="val_test",
        scenario_name="Validation Test",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=50, duration_seconds=1800),
    )
    val = engine.validate_scenario(config)
    assert val.valid is True
    assert len(val.errors) == 0


def test_scenario_validation_invalid_demand(engine):
    with pytest.raises(ValueError):
        # Pydantic validates ge=1
        DemandConfig(vehicle_count=0)


def test_baseline_simulation_run(engine):
    config = ScenarioConfig(
        scenario_id="baseline_run_test",
        scenario_name="Baseline Test",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=60, duration_seconds=1800, seed=123),
    )
    result = engine.run(config)
    assert result.status == "completed"
    assert result.data_label == "SIMULATED"
    assert result.seed == 123
    assert result.engine_id == "graph_engine_v1"

    m = result.metrics
    assert m.completed_trips.value > 0
    assert m.avg_travel_time_s.value > 0
    assert m.avg_distance_m.value > 0
    assert m.throughput_veh_per_hr.value > 0
    assert len(result.edge_metrics) > 0


def test_deterministic_reproducibility(engine):
    """Running identical scenario configuration with same seed must yield identical metrics."""
    config1 = ScenarioConfig(
        scenario_id="det_1",
        scenario_name="Determinism Test 1",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=80, duration_seconds=1800, seed=999),
    )
    config2 = ScenarioConfig(
        scenario_id="det_2",
        scenario_name="Determinism Test 2",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=80, duration_seconds=1800, seed=999),
    )

    res1 = engine.run(config1)
    res2 = engine.run(config2)

    assert res1.metrics.completed_trips.value == res2.metrics.completed_trips.value
    assert res1.metrics.avg_travel_time_s.value == res2.metrics.avg_travel_time_s.value
    assert res1.metrics.avg_waiting_time_s.value == res2.metrics.avg_waiting_time_s.value
    assert res1.metrics.avg_distance_m.value == res2.metrics.avg_distance_m.value


def test_demand_increase_impact(engine):
    """Higher vehicle demand increases overall link volumes and travel times."""
    base_config = ScenarioConfig(
        scenario_id="low_demand",
        scenario_name="Low Demand",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=50, duration_seconds=1800, seed=42),
    )
    high_config = ScenarioConfig(
        scenario_id="high_demand",
        scenario_name="High Demand",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=150, duration_seconds=1800, seed=42),
    )

    base_res = engine.run(base_config)
    high_res = engine.run(high_config)

    assert high_res.metrics.completed_trips.value > base_res.metrics.completed_trips.value
    assert high_res.metrics.avg_waiting_time_s.value >= base_res.metrics.avg_waiting_time_s.value


def test_road_closure_intervention(engine):
    """Closing edges flags them as closed in edge_metrics and forces dynamic rerouting."""
    loader = NetworkLoader()
    G, _ = loader.load_network("jaipur_v1")

    # Pick an edge with traffic
    sample_edge = next(iter(G.edges(data=True)))
    closed_edge_id = sample_edge[2].get("edge_id")

    config = ScenarioConfig(
        scenario_id="closure_test",
        scenario_name="Closure Test",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=50, duration_seconds=1800, seed=42),
        closures=RoadClosureIntervention(edge_ids=[closed_edge_id]),
    )

    result = engine.run(config)
    assert result.status == "completed"
    assert closed_edge_id in result.edge_metrics
    assert result.edge_metrics[closed_edge_id].closed is True
    assert result.edge_metrics[closed_edge_id].volume_veh == 0


def test_signal_timing_intervention(engine):
    """Signal timing intervention applies Webster control delay to approach edges."""
    loader = NetworkLoader()
    G, _ = loader.load_network("jaipur_v1")

    # Pick an intersection node with in-edges
    target_node = next(iter(G.nodes()))

    config = ScenarioConfig(
        scenario_id="signal_test",
        scenario_name="Signal Optimization Test",
        network_id="jaipur_v1",
        scenario_type=ScenarioType.SIGNAL_TIMING,
        demand=DemandConfig(vehicle_count=60, duration_seconds=1800, seed=42),
        signals=SignalTimingIntervention(
            intersection_node_id=target_node,
            cycle_time_s=90.0,
            green_split_ratio=0.6,
        ),
    )

    result = engine.run(config)
    assert result.status == "completed"
    assert any("Webster signal control model" in a for a in result.assumptions)


def test_incident_bottleneck_queue_delay(engine):
    """Incident causing severe capacity drop triggers physical queuing delay."""
    loader = NetworkLoader()
    G, _ = loader.load_network("jaipur_v1")

    sample_edge = next(iter(G.edges(data=True)))
    incident_edge_id = sample_edge[2].get("edge_id")

    config = ScenarioConfig(
        scenario_id="incident_test",
        scenario_name="Incident Bottleneck Test",
        network_id="jaipur_v1",
        scenario_type=ScenarioType.INCIDENT,
        demand=DemandConfig(vehicle_count=80, duration_seconds=1800, seed=42),
        incidents=IncidentIntervention(
            edge_ids=[incident_edge_id],
            capacity_reduction_factor=0.2,
            speed_reduction_factor=0.3,
        ),
    )

    result = engine.run(config)
    assert result.status == "completed"
    assert any("Incident queue bottleneck model" in a for a in result.assumptions)
    assert incident_edge_id in result.edge_metrics
