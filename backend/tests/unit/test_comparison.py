"""
backend/tests/unit/test_comparison.py

Unit tests for ScenarioComparator.
Verifies metric delta calculation, domain improvement/deterioration logic,
and compatibility checks between simulation runs.
"""

import pytest
from backend.simulation.engines.base import (
    DemandConfig,
    RoadClosureIntervention,
    ScenarioConfig,
    ScenarioType,
)
from backend.simulation.engines.graph_engine import GraphEngine
from backend.simulation.comparison import ScenarioComparator
from backend.simulation.network_loader import NetworkLoader


@pytest.fixture(scope="module")
def sim_results():
    engine = GraphEngine()

    # 1. Baseline
    base_cfg = ScenarioConfig(
        scenario_id="cmp_baseline",
        scenario_name="Baseline",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=50, duration_seconds=1800, seed=100),
    )
    base_res = engine.run(base_cfg)

    # 2. Demand increase (+100%)
    high_cfg = ScenarioConfig(
        scenario_id="cmp_high_demand",
        scenario_name="High Demand",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=100, duration_seconds=1800, seed=100),
    )
    high_res = engine.run(high_cfg)

    # 3. Road closure
    loader = NetworkLoader()
    G, _ = loader.load_network("jaipur_v1")
    sample_edge = next(iter(G.edges(data=True)))
    closed_id = sample_edge[2].get("edge_id")

    closure_cfg = ScenarioConfig(
        scenario_id="cmp_closure",
        scenario_name="Closure",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=50, duration_seconds=1800, seed=100),
        closures=RoadClosureIntervention(edge_ids=[closed_id]),
    )
    closure_res = engine.run(closure_cfg)

    return {
        "baseline": base_res,
        "high_demand": high_res,
        "closure": closure_res,
    }


def test_compare_baseline_vs_high_demand(sim_results):
    baseline = sim_results["baseline"]
    high_demand = sim_results["high_demand"]

    cmp = ScenarioComparator.compare(baseline, high_demand)
    assert cmp.compatible is True
    assert len(cmp.compatibility_warnings) == 0
    assert len(cmp.metrics) >= 6

    # Verify travel time delta
    tt_item = next(m for m in cmp.metrics if m.metric_name == "avg_travel_time_s")
    assert tt_item.baseline_value == baseline.metrics.avg_travel_time_s.value
    assert tt_item.target_value == high_demand.metrics.avg_travel_time_s.value
    assert tt_item.absolute_diff == round(
        high_demand.metrics.avg_travel_time_s.value - baseline.metrics.avg_travel_time_s.value, 2
    )

    # Throughput should be higher and classified as improved
    tp_item = next(m for m in cmp.metrics if m.metric_name == "throughput_veh_per_hr")
    assert tp_item.direction == "improved"
    assert tp_item.target_value > tp_item.baseline_value

    # Verify summary verdict string
    assert len(cmp.summary_verdict) > 0


def test_compare_baseline_vs_closure(sim_results):
    baseline = sim_results["baseline"]
    closure = sim_results["closure"]

    cmp = ScenarioComparator.compare(baseline, closure)
    assert cmp.compatible is True
    assert len(cmp.metrics) >= 6
    assert cmp.baseline_run_id == baseline.run_id
    assert cmp.target_run_id == closure.run_id


def test_compatibility_warning_on_duration_mismatch(sim_results):
    engine = GraphEngine()
    baseline = sim_results["baseline"]

    mismatched_cfg = ScenarioConfig(
        scenario_id="cmp_mismatch",
        scenario_name="Mismatch Duration",
        network_id="jaipur_v1",
        demand=DemandConfig(vehicle_count=50, duration_seconds=3600, seed=100),
    )
    mismatched_res = engine.run(mismatched_cfg)

    cmp = ScenarioComparator.compare(baseline, mismatched_res)
    assert cmp.compatible is False
    assert any("durations" in w for w in cmp.compatibility_warnings)
