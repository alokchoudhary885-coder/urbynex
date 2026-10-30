"""
backend/tests/unit/test_monte_carlo.py

Unit tests for Monte Carlo multi-seed stochastic simulation & confidence interval estimation (M3.5/M3.6).
"""

import pytest
from backend.simulation.engines.base import (
    DemandConfig,
    ScenarioConfig,
    ScenarioType,
)
from backend.simulation.engines.graph_engine import GraphEngine
from backend.simulation.monte_carlo import MonteCarloRunner, MonteCarloBatchResult


@pytest.fixture
def monte_carlo_runner():
    return MonteCarloRunner(engine=GraphEngine())


@pytest.fixture
def sample_scenario_config():
    return ScenarioConfig(
        scenario_id="scen_mc_test",
        scenario_name="Monte Carlo Test Scenario",
        network_id="jaipur_v1",
        scenario_type=ScenarioType.BASELINE,
        demand=DemandConfig(vehicle_count=40, duration_seconds=1200, seed=42),
    )


def test_monte_carlo_min_seeds_validation(monte_carlo_runner, sample_scenario_config):
    """Monte Carlo batch must reject fewer than 2 seeds."""
    with pytest.raises(ValueError, match="at least 2 distinct seeds"):
        monte_carlo_runner.run_batch(sample_scenario_config, seeds=[42], persist_runs=False)

    with pytest.raises(ValueError, match="at least 2 distinct seeds"):
        monte_carlo_runner.run_batch(sample_scenario_config, seeds=[], persist_runs=False)


def test_monte_carlo_batch_statistics(monte_carlo_runner, sample_scenario_config):
    """Executes a 3-seed Monte Carlo run and verifies statistical calculations."""
    seeds = [101, 202, 303]
    result: MonteCarloBatchResult = monte_carlo_runner.run_batch(
        sample_scenario_config, seeds=seeds, persist_runs=False
    )

    assert result.scenario_id == sample_scenario_config.scenario_id
    assert result.seed_count == 3
    assert result.seeds == seeds
    assert len(result.individual_runs) == 3
    assert result.total_execution_time_seconds > 0

    # Verify key metrics exist in summary
    expected_metrics = [
        "completed_trips",
        "avg_travel_time_s",
        "avg_waiting_time_s",
        "avg_distance_m",
        "throughput_veh_per_hr",
        "routing_failures",
    ]
    for metric_name in expected_metrics:
        assert metric_name in result.metrics_summary
        dist = result.metrics_summary[metric_name]
        assert dist.metric_name == metric_name
        assert dist.min_value <= dist.mean <= dist.max_value
        assert dist.std_dev >= 0.0
        assert dist.ci_95_lower <= dist.ci_95_upper
        assert dist.ci_95_lower <= dist.mean <= dist.ci_95_upper


def test_monte_carlo_deterministic_consistency(monte_carlo_runner, sample_scenario_config):
    """Same set of seeds must produce identical statistical summary across runs."""
    seeds = [77, 88]
    res1 = monte_carlo_runner.run_batch(sample_scenario_config, seeds=seeds, persist_runs=False)
    res2 = monte_carlo_runner.run_batch(sample_scenario_config, seeds=seeds, persist_runs=False)

    for metric_name in ["completed_trips", "avg_travel_time_s"]:
        d1 = res1.metrics_summary[metric_name]
        d2 = res2.metrics_summary[metric_name]
        assert d1.mean == d2.mean
        assert d1.std_dev == d2.std_dev
        assert d1.ci_95_lower == d2.ci_95_lower
        assert d1.ci_95_upper == d2.ci_95_upper
