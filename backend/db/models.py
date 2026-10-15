"""
backend/db/models.py

SQLAlchemy ORM models representing persistent database entities.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    JSON,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from .session import Base


class CityNetworkModel(Base):
    """Registered road networks and validation states."""
    __tablename__ = "city_networks"

    network_id = Column(String(64), primary_key=True)
    city_id = Column(String(64), nullable=False, index=True)
    city_name = Column(String(128), nullable=False)
    corridor = Column(String(256), nullable=False)
    version = Column(String(32), default="v1")
    node_count = Column(Integer, nullable=False)
    edge_count = Column(Integer, nullable=False)
    total_road_length_km = Column(Float, nullable=False)
    validation_status = Column(String(32), default="passed")
    simulation_ready = Column(Boolean, default=True)
    sha256_hash = Column(String(64), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    scenarios = relationship("ScenarioModel", back_populates="network")


class ScenarioModel(Base):
    """User-configured traffic scenarios and interventions."""
    __tablename__ = "scenarios"

    scenario_id = Column(String(64), primary_key=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, default="")
    city_id = Column(String(64), nullable=False, index=True)
    network_id = Column(String(64), ForeignKey("city_networks.network_id"), nullable=False)
    scenario_type = Column(String(32), default="baseline", index=True)
    demand_json = Column(JSON, nullable=False)
    interventions_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    network = relationship("CityNetworkModel", back_populates="scenarios")
    runs = relationship("SimulationRunModel", back_populates="scenario", cascade="all, delete-orphan")


class SimulationRunModel(Base):
    """Executed simulation jobs and structured metric outputs."""
    __tablename__ = "simulation_runs"

    run_id = Column(String(64), primary_key=True)
    scenario_id = Column(String(64), ForeignKey("scenarios.scenario_id"), nullable=False, index=True)
    engine_id = Column(String(64), nullable=False)
    engine_version = Column(String(32), default="1.0.0")
    network_id = Column(String(64), nullable=False, index=True)
    seed = Column(Integer, nullable=False)
    status = Column(String(32), default="completed", index=True)  # queued, running, completed, failed, cancelled

    # Primary scalar metrics stored as columns for high-speed indexing & sorting
    completed_trips = Column(Float, nullable=True)
    avg_travel_time_s = Column(Float, nullable=True)
    avg_waiting_time_s = Column(Float, nullable=True)
    avg_distance_m = Column(Float, nullable=True)
    throughput_veh_per_hr = Column(Float, nullable=True)
    active_vehicles = Column(Float, nullable=True)
    routing_failures = Column(Float, nullable=True)
    simulation_duration_s = Column(Float, nullable=True)
    execution_time_seconds = Column(Float, nullable=True)

    # Detailed payloads
    metrics_json = Column(JSON, nullable=False)
    edge_metrics_json = Column(JSON, nullable=True)
    sample_trips_json = Column(JSON, nullable=True)
    assumptions_json = Column(JSON, nullable=True)
    warnings_json = Column(JSON, nullable=True)
    data_label = Column(String(32), default="SIMULATED")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    scenario = relationship("ScenarioModel", back_populates="runs")
