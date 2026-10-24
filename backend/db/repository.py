"""
backend/db/repository.py

Repository for persisting and querying scenarios, road networks, and simulation runs.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from .session import Base, engine, SessionLocal
from .models import CityNetworkModel, ScenarioModel, SimulationRunModel
from ..simulation.engines.base import ScenarioConfig, SimulationResult


class RunRepository:
    """Handles database transactions for Urbynex simulations."""

    def __init__(self, db: Optional[Session] = None):
        self._external_db = db

    def _get_session(self) -> Session:
        return self._external_db if self._external_db is not None else SessionLocal()

    @staticmethod
    def init_db():
        """Creates all database tables."""
        Base.metadata.create_all(bind=engine)

    def sync_network_metadata(self, metadata: Dict[str, Any]) -> CityNetworkModel:
        """Upserts a road network record from metadata."""
        db = self._get_session()
        try:
            net_id = metadata["network_id"]
            existing = db.query(CityNetworkModel).filter_by(network_id=net_id).first()

            if existing:
                existing.node_count = metadata["node_count"]
                existing.edge_count = metadata["edge_count"]
                existing.total_road_length_km = metadata["total_road_length_km"]
                existing.validation_status = metadata.get("validation_status", "passed")
                existing.simulation_ready = metadata.get("simulation_ready", True)
                existing.sha256_hash = metadata.get("sha256_hash")
                existing.metadata_json = metadata
                model = existing
            else:
                model = CityNetworkModel(
                    network_id=net_id,
                    city_id=metadata["city_id"],
                    city_name=metadata["city_name"],
                    corridor=metadata.get("corridor", "Urban Corridor"),
                    version=metadata.get("version", "v1"),
                    node_count=metadata["node_count"],
                    edge_count=metadata["edge_count"],
                    total_road_length_km=metadata["total_road_length_km"],
                    validation_status=metadata.get("validation_status", "passed"),
                    simulation_ready=metadata.get("simulation_ready", True),
                    sha256_hash=metadata.get("sha256_hash"),
                    metadata_json=metadata,
                )
                db.add(model)
            db.commit()
            db.refresh(model)
            return model
        finally:
            if self._external_db is None:
                db.close()

    def save_scenario(self, config: ScenarioConfig) -> ScenarioModel:
        """Saves a scenario specification."""
        db = self._get_session()
        try:
            interventions = {}
            if config.closures:
                interventions["closures"] = config.closures.model_dump()
            if config.incidents:
                interventions["incidents"] = config.incidents.model_dump()
            if config.signals:
                interventions["signals"] = config.signals.model_dump()

            existing = db.query(ScenarioModel).filter_by(scenario_id=config.scenario_id).first()
            if existing:
                existing.name = config.scenario_name
                existing.description = config.description or ""
                existing.demand_json = config.demand.model_dump()
                existing.interventions_json = interventions
                existing.scenario_type = config.scenario_type.value
                model = existing
            else:
                model = ScenarioModel(
                    scenario_id=config.scenario_id,
                    name=config.scenario_name,
                    description=config.description or "",
                    city_id=config.city_id,
                    network_id=config.network_id,
                    scenario_type=config.scenario_type.value,
                    demand_json=config.demand.model_dump(),
                    interventions_json=interventions,
                )
                db.add(model)
            db.commit()
            db.refresh(model)
            return model
        finally:
            if self._external_db is None:
                db.close()

    def get_scenario(self, scenario_id: str) -> Optional[ScenarioModel]:
        """Fetches scenario by identifier."""
        db = self._get_session()
        try:
            return db.query(ScenarioModel).filter_by(scenario_id=scenario_id).first()
        finally:
            if self._external_db is None:
                db.close()

    def save_simulation_run(self, result: SimulationResult) -> SimulationRunModel:
        """Persists a complete simulation run and its metrics."""
        db = self._get_session()
        try:
            # Ensure scenario exists first
            self.save_scenario(result.scenario_config)

            m = result.metrics
            edge_metrics_dict = {
                eid: em.model_dump() for eid, em in result.edge_metrics.items()
            }
            sample_trips_list = [t.model_dump() for t in result.sample_trips]

            model = SimulationRunModel(
                run_id=result.run_id,
                scenario_id=result.scenario_config.scenario_id,
                engine_id=result.engine_id,
                engine_version=result.engine_version,
                network_id=result.network_id,
                seed=result.seed,
                status=result.status,
                completed_trips=m.completed_trips.value,
                avg_travel_time_s=m.avg_travel_time_s.value,
                avg_waiting_time_s=m.avg_waiting_time_s.value,
                avg_distance_m=m.avg_distance_m.value,
                throughput_veh_per_hr=m.throughput_veh_per_hr.value,
                active_vehicles=m.active_vehicles.value,
                routing_failures=m.routing_failures.value,
                simulation_duration_s=m.simulation_duration_s.value,
                execution_time_seconds=result.execution_time_seconds,
                metrics_json=m.model_dump(),
                edge_metrics_json=edge_metrics_dict,
                sample_trips_json=sample_trips_list,
                assumptions_json=result.assumptions,
                warnings_json=result.warnings,
                data_label=result.data_label,
            )
            db.add(model)
            db.commit()
            db.refresh(model)
            return model
        finally:
            if self._external_db is None:
                db.close()

    def get_simulation_run(self, run_id: str) -> Optional[SimulationRunModel]:
        """Retrieves a simulation run by its ID."""
        db = self._get_session()
        try:
            return db.query(SimulationRunModel).filter_by(run_id=run_id).first()
        finally:
            if self._external_db is None:
                db.close()

    def list_simulation_runs(self, limit: int = 50) -> List[SimulationRunModel]:
        """Lists simulation runs in reverse chronological order."""
        db = self._get_session()
        try:
            return (
                db.query(SimulationRunModel)
                .order_by(SimulationRunModel.created_at.desc())
                .limit(limit)
                .all()
            )
        finally:
            if self._external_db is None:
                db.close()

    def list_cities(self) -> List[Dict[str, Any]]:
        """Returns distinct cities with network availability details."""
        db = self._get_session()
        try:
            networks = db.query(CityNetworkModel).all()
            cities_dict: Dict[str, Dict[str, Any]] = {}
            for net in networks:
                cid = net.city_id
                if cid not in cities_dict:
                    cities_dict[cid] = {
                        "city_id": cid,
                        "name": net.city_name,
                        "country": "India",
                        "status": "network_ready" if net.simulation_ready else "validating",
                        "networks_available": 0,
                        "description": net.corridor,
                    }
                cities_dict[cid]["networks_available"] += 1
            return list(cities_dict.values())
        finally:
            if self._external_db is None:
                db.close()

    def list_networks(self, city_id: Optional[str] = None) -> List[CityNetworkModel]:
        """Lists registered road networks, optionally filtered by city."""
        db = self._get_session()
        try:
            query = db.query(CityNetworkModel)
            if city_id:
                query = query.filter_by(city_id=city_id)
            return query.all()
        finally:
            if self._external_db is None:
                db.close()

    def get_network(self, network_id: str) -> Optional[CityNetworkModel]:
        """Gets network record by network_id."""
        db = self._get_session()
        try:
            return db.query(CityNetworkModel).filter_by(network_id=network_id).first()
        finally:
            if self._external_db is None:
                db.close()

    def list_scenarios(self, city_id: Optional[str] = None, limit: int = 50) -> List[ScenarioModel]:
        """Lists scenarios, optionally filtered by city_id."""
        db = self._get_session()
        try:
            query = db.query(ScenarioModel)
            if city_id:
                query = query.filter_by(city_id=city_id)
            return query.order_by(ScenarioModel.created_at.desc()).limit(limit).all()
        finally:
            if self._external_db is None:
                db.close()

    def create_simulation_job(
        self,
        run_id: str,
        scenario_id: str,
        engine_id: str,
        network_id: str,
        seed: int,
    ) -> SimulationRunModel:
        """Creates a pending simulation run record with 'queued' status."""
        db = self._get_session()
        try:
            model = SimulationRunModel(
                run_id=run_id,
                scenario_id=scenario_id,
                engine_id=engine_id,
                engine_version="1.0.0",
                network_id=network_id,
                seed=seed,
                status="queued",
                metrics_json={},
            )
            db.add(model)
            db.commit()
            db.refresh(model)
            return model
        finally:
            if self._external_db is None:
                db.close()

    def update_run_status(self, run_id: str, status: str, error_message: Optional[str] = None) -> Optional[SimulationRunModel]:
        """Updates status of a running/failed simulation."""
        db = self._get_session()
        try:
            model = db.query(SimulationRunModel).filter_by(run_id=run_id).first()
            if model:
                model.status = status
                if error_message:
                    model.warnings_json = (model.warnings_json or []) + [f"Error: {error_message}"]
                db.commit()
                db.refresh(model)
            return model
        finally:
            if self._external_db is None:
                db.close()

