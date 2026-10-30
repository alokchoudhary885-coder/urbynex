"""
backend/api/services/simulation_service.py

Simulation orchestration service. Coordinates scenario preparation, engine execution,
background task management, and scenario comparison.
"""

import time
from typing import Optional
from ...db.repository import RunRepository
from ...db.models import SimulationRunModel
from ...simulation.engines.base import (
    DemandConfig,
    IncidentIntervention,
    MetricItem,
    RoadClosureIntervention,
    ScenarioConfig,
    ScenarioType,
    SignalTimingIntervention,
    SimulationMetrics,
    SimulationResult,
)
from ...simulation.engines.graph_engine import GraphEngine
from ...simulation.comparison import ScenarioComparator, ComparisonResult
from ...simulation.monte_carlo import MonteCarloRunner, MonteCarloBatchResult


class SimulationService:
    """Coordinates simulation runs and result comparisons."""

    def __init__(self, repo: RunRepository, engine: Optional[GraphEngine] = None):
        self.repo = repo
        self.engine = engine or GraphEngine()

    def _build_scenario_config(
        self,
        scenario_model,
        seed_override: Optional[int] = None,
    ) -> ScenarioConfig:
        """Reconstructs a ScenarioConfig from a database scenario record."""
        demand_data = dict(scenario_model.demand_json or {})
        if seed_override is not None:
            demand_data["seed"] = seed_override
        demand = DemandConfig(**demand_data)

        interventions = scenario_model.interventions_json or {}
        closures = RoadClosureIntervention(**interventions["closures"]) if "closures" in interventions and interventions["closures"] else None
        incidents = IncidentIntervention(**interventions["incidents"]) if "incidents" in interventions and interventions["incidents"] else None
        signals = SignalTimingIntervention(**interventions["signals"]) if "signals" in interventions and interventions["signals"] else None

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
            signals=signals,
        )

    def run_simulation(
        self,
        scenario_id: str,
        engine_id: str = "graph_engine_v1",
        seed_override: Optional[int] = None,
    ) -> SimulationResult:
        """Executes a simulation synchronously and persists the result."""
        scenario_model = self.repo.get_scenario(scenario_id)
        if not scenario_model:
            raise ValueError(f"Scenario '{scenario_id}' not found.")

        config = self._build_scenario_config(scenario_model, seed_override=seed_override)

        # Validate scenario
        validation = self.engine.validate_scenario(config)
        if not validation.valid:
            raise ValueError(f"Scenario validation failed: {'; '.join(validation.errors)}")

        # Execute simulation
        result = self.engine.run(config)

        # Persist result
        self.repo.save_simulation_run(result)
        return result

    def run_monte_carlo(
        self,
        scenario_id: str,
        seeds: list[int],
        engine_id: str = "graph_engine_v1",
    ) -> MonteCarloBatchResult:
        """Executes a multi-seed Monte Carlo batch across the scenario."""
        scenario_model = self.repo.get_scenario(scenario_id)
        if not scenario_model:
            raise ValueError(f"Scenario '{scenario_id}' not found.")

        config = self._build_scenario_config(scenario_model)

        validation = self.engine.validate_scenario(config)
        if not validation.valid:
            raise ValueError(f"Scenario validation failed: {'; '.join(validation.errors)}")

        runner = MonteCarloRunner(engine=self.engine, repo=self.repo)
        return runner.run_batch(config, seeds=seeds, persist_runs=True)

    def execute_background_job(
        self,
        run_id: str,
        scenario_id: str,
        seed_override: Optional[int] = None,
    ) -> None:
        """Executes a simulation in a background worker task and updates run status."""
        self.repo.update_run_status(run_id, status="running")
        try:
            result = self.run_simulation(
                scenario_id=scenario_id,
                seed_override=seed_override,
            )
            # Result is saved by run_simulation; make sure run_id matches job if requested
        except Exception as e:
            self.repo.update_run_status(run_id, status="failed", error_message=str(e))

    def compare_simulation_runs(self, baseline_run_id: str, target_run_id: str) -> ComparisonResult:
        """Compares two persisted simulation runs using ScenarioComparator."""
        base_model = self.repo.get_simulation_run(baseline_run_id)
        if not base_model:
            raise ValueError(f"Baseline simulation run '{baseline_run_id}' not found.")

        target_model = self.repo.get_simulation_run(target_run_id)
        if not target_model:
            raise ValueError(f"Target simulation run '{target_run_id}' not found.")

        base_res = self._model_to_simulation_result(base_model)
        target_res = self._model_to_simulation_result(target_model)

        return ScenarioComparator.compare(base_res, target_res)

    def _model_to_simulation_result(self, model: SimulationRunModel) -> SimulationResult:
        """Reconstructs a SimulationResult from its database record."""
        scenario_model = self.repo.get_scenario(model.scenario_id)
        if scenario_model:
            demand = DemandConfig(**(scenario_model.demand_json or {}))
            cfg = ScenarioConfig(
                scenario_id=scenario_model.scenario_id,
                scenario_name=scenario_model.name,
                description=scenario_model.description,
                city_id=scenario_model.city_id,
                network_id=scenario_model.network_id,
                scenario_type=ScenarioType(scenario_model.scenario_type),
                demand=demand,
            )
        else:
            cfg = ScenarioConfig(
                scenario_id=model.scenario_id,
                scenario_name=model.scenario_id,
                city_id="jaipur",
                network_id=model.network_id,
                scenario_type=ScenarioType.BASELINE,
                demand=DemandConfig(seed=model.seed),
            )

        # Parse metrics
        m_json = model.metrics_json or {}
        metrics = SimulationMetrics(
            completed_trips=MetricItem(**m_json.get("completed_trips", {"value": model.completed_trips or 0, "unit": "trips", "description": ""})),
            avg_travel_time_s=MetricItem(**m_json.get("avg_travel_time_s", {"value": model.avg_travel_time_s or 0, "unit": "seconds", "description": ""})),
            avg_waiting_time_s=MetricItem(**m_json.get("avg_waiting_time_s", {"value": model.avg_waiting_time_s or 0, "unit": "seconds", "description": ""})),
            avg_distance_m=MetricItem(**m_json.get("avg_distance_m", {"value": model.avg_distance_m or 0, "unit": "meters", "description": ""})),
            throughput_veh_per_hr=MetricItem(**m_json.get("throughput_veh_per_hr", {"value": model.throughput_veh_per_hr or 0, "unit": "veh/hr", "description": ""})),
            active_vehicles=MetricItem(**m_json.get("active_vehicles", {"value": model.active_vehicles or 0, "unit": "vehicles", "description": ""})),
            routing_failures=MetricItem(**m_json.get("routing_failures", {"value": model.routing_failures or 0, "unit": "vehicles", "description": ""})),
            simulation_duration_s=MetricItem(**m_json.get("simulation_duration_s", {"value": model.simulation_duration_s or 3600, "unit": "seconds", "description": ""})),
        )

        return SimulationResult(
            run_id=model.run_id,
            scenario_config=cfg,
            engine_id=model.engine_id,
            engine_version=model.engine_version or "1.0.0",
            network_id=model.network_id,
            seed=model.seed,
            status=model.status,
            metrics=metrics,
            edge_metrics={},
            sample_trips=[],
            assumptions=model.assumptions_json or [],
            warnings=model.warnings_json or [],
            data_label=model.data_label or "SIMULATED",
            execution_time_seconds=model.execution_time_seconds or 0.0,
        )
