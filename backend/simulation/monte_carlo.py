"""
backend/simulation/monte_carlo.py

Multi-Seed Monte Carlo Simulation & Statistical Aggregation Engine (M3.5/M3.6).
Executes repeated deterministic simulations across diverse random seeds to quantify
stochastic traffic variance and produce 95% confidence intervals for city planners.
"""

import math
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field

from .engines.base import ScenarioConfig, SimulationResult
from .engines.graph_engine import GraphEngine
from ..db.repository import RunRepository


@dataclass
class MetricDistribution:
    """Summary statistics for a single simulation metric across Monte Carlo seeds."""
    metric_name: str
    unit: str
    mean: float
    std_dev: float
    min_value: float
    max_value: float
    ci_95_lower: float
    ci_95_upper: float


@dataclass
class MonteCarloBatchResult:
    """Aggregated output from a multi-seed simulation experiment."""
    scenario_id: str
    seed_count: int
    seeds: List[int]
    metrics_summary: Dict[str, MetricDistribution]
    individual_runs: List[SimulationResult]
    total_execution_time_seconds: float


class MonteCarloRunner:
    """
    Executes multi-seed Monte Carlo experiments on the GraphEngine.
    """

    def __init__(self, engine: Optional[GraphEngine] = None, repo: Optional[RunRepository] = None):
        self.engine = engine or GraphEngine()
        self.repo = repo or RunRepository()

    def run_batch(
        self,
        config: ScenarioConfig,
        seeds: List[int],
        persist_runs: bool = True,
    ) -> MonteCarloBatchResult:
        """
        Executes a batch of deterministic simulations across given seeds.
        Computes mean, standard deviation, min/max, and 95% confidence intervals.
        """
        if not seeds or len(seeds) < 2:
            raise ValueError("Monte Carlo batch requires at least 2 distinct seeds.")

        t_start = time.time()
        individual_results: List[SimulationResult] = []

        # Metric accumulators
        metric_values: Dict[str, List[float]] = {
            "completed_trips": [],
            "avg_travel_time_s": [],
            "avg_waiting_time_s": [],
            "avg_distance_m": [],
            "throughput_veh_per_hr": [],
            "routing_failures": [],
        }

        metric_units: Dict[str, str] = {
            "completed_trips": "trips",
            "avg_travel_time_s": "seconds",
            "avg_waiting_time_s": "seconds",
            "avg_distance_m": "meters",
            "throughput_veh_per_hr": "veh/hr",
            "routing_failures": "vehicles",
        }

        # Execute simulation for each seed
        for s in seeds:
            seed_config = config.model_copy(deep=True)
            seed_config.demand.seed = int(s)

            res = self.engine.run(seed_config)
            individual_results.append(res)

            if persist_runs:
                self.repo.save_simulation_run(res)

            m = res.metrics
            metric_values["completed_trips"].append(float(m.completed_trips.value))
            metric_values["avg_travel_time_s"].append(float(m.avg_travel_time_s.value))
            metric_values["avg_waiting_time_s"].append(float(m.avg_waiting_time_s.value))
            metric_values["avg_distance_m"].append(float(m.avg_distance_m.value))
            metric_values["throughput_veh_per_hr"].append(float(m.throughput_veh_per_hr.value))
            metric_values["routing_failures"].append(float(m.routing_failures.value))

        # Compute statistical distribution for each metric
        N = len(seeds)
        metrics_summary: Dict[str, MetricDistribution] = {}

        for m_name, vals in metric_values.items():
            mean_val = sum(vals) / float(N)
            variance = sum((x - mean_val) ** 2 for x in vals) / float(N - 1) if N > 1 else 0.0
            std_dev = math.sqrt(variance)
            se = std_dev / math.sqrt(N)
            ci_half = 1.96 * se

            metrics_summary[m_name] = MetricDistribution(
                metric_name=m_name,
                unit=metric_units[m_name],
                mean=round(mean_val, 2),
                std_dev=round(std_dev, 2),
                min_value=round(min(vals), 2),
                max_value=round(max(vals), 2),
                ci_95_lower=round(max(0.0, mean_val - ci_half), 2),
                ci_95_upper=round(mean_val + ci_half, 2),
            )

        elapsed = round(time.time() - t_start, 2)
        return MonteCarloBatchResult(
            scenario_id=config.scenario_id,
            seed_count=N,
            seeds=seeds,
            metrics_summary=metrics_summary,
            individual_runs=individual_results,
            total_execution_time_seconds=elapsed,
        )
