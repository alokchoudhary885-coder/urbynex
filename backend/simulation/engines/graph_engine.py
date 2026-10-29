"""
backend/simulation/engines/graph_engine.py

Engine A: Graph-based traffic simulation engine for rapid network experiments.
Implements dynamic shortest-path assignment, Bureau of Public Roads (BPR) link
congestion delay, road closures, and comprehensive metric extraction.
"""

import time
import uuid
from typing import Dict, List, Optional, Set
import networkx as nx
from .base import (
    EngineCapabilities,
    EngineType,
    EdgeMetricRecord,
    MetricItem,
    ScenarioConfig,
    ScenarioType,
    SimulationEngine,
    SimulationMetrics,
    SimulationResult,
    ValidationResult,
    VehicleTripRecord,
)
from .bpr import BPRLinkPerformance
from .webster import WebsterSignalDelay
from ..network_loader import NetworkLoader


class GraphEngine(SimulationEngine):
    """
    Engine A: Deterministic graph-based traffic simulator.
    Calculates dynamic route assignment and link congestion using BPR link performance.
    """

    ENGINE_ID = "graph_engine_v1"
    ENGINE_VERSION = "1.0.0"

    def __init__(
        self,
        network_loader: Optional[NetworkLoader] = None,
        bpr: Optional[BPRLinkPerformance] = None,
        webster: Optional[WebsterSignalDelay] = None,
    ):
        self.network_loader = network_loader or NetworkLoader()
        self.bpr = bpr or BPRLinkPerformance(alpha=0.15, beta=4.0)
        self.webster = webster or WebsterSignalDelay()

    @property
    def engine_id(self) -> str:
        return self.ENGINE_ID

    def get_capabilities(self) -> EngineCapabilities:
        return EngineCapabilities(
            engine_id=self.ENGINE_ID,
            name="Lightweight Graph-Based Traffic Simulator",
            supported_scenarios=[
                ScenarioType.BASELINE,
                ScenarioType.DEMAND_CHANGE,
                ScenarioType.ROAD_CLOSURE,
                ScenarioType.INCIDENT,
                ScenarioType.SIGNAL_TIMING,
            ],
            supports_lane_changing=False,
            supports_signal_timing=True,
            supports_queue_spillback=False,
            description="Pure Python graph simulator utilizing dynamic shortest paths, BPR congestion delay, and Webster intersection signal control timing.",
        )

    def validate_scenario(self, config: ScenarioConfig) -> ValidationResult:
        """Validates that the scenario can be executed on the specified network."""
        errors: List[str] = []
        warnings: List[str] = []

        try:
            G, metadata = self.network_loader.load_network(config.network_id)
        except Exception as e:
            return ValidationResult(valid=False, errors=[f"Cannot load network: {e}"], warnings=[])

        # Validate road closures if any
        if config.closures and config.closures.edge_ids:
            all_edge_ids = set()
            for _, _, d in G.edges(data=True):
                all_edge_ids.add(d.get("edge_id"))

            for cid in config.closures.edge_ids:
                if cid not in all_edge_ids:
                    warnings.append(f"Closure edge ID '{cid}' not found in network {config.network_id}.")

        # Validate signal timing if configured
        if config.signals:
            if config.signals.cycle_time_s < 30.0 or config.signals.cycle_time_s > 240.0:
                errors.append("Signal cycle time must be between 30 and 240 seconds.")
            if config.signals.green_split_ratio < 0.1 or config.signals.green_split_ratio > 0.9:
                errors.append("Signal green split ratio must be between 0.1 and 0.9.")
            target_node = str(config.signals.intersection_node_id)
            node_ids_str = {str(n) for n in G.nodes}
            if target_node not in node_ids_str:
                warnings.append(f"Signal intersection node '{target_node}' not found in network {config.network_id}.")

        # Check vehicle count
        if config.demand.vehicle_count <= 0:
            errors.append("Vehicle count must be greater than 0.")
        if config.demand.duration_seconds <= 0:
            errors.append("Simulation duration must be greater than 0 seconds.")

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    def _prepare_simulation_graph(self, G: nx.DiGraph, config: ScenarioConfig) -> tuple[nx.DiGraph, Set[str]]:
        """
        Creates an execution graph copy with applied interventions (closures, incidents).
        Returns the modified graph and the set of closed edge IDs.
        """
        sim_G = G.copy()
        closed_edges: Set[str] = set()

        # 1. Road closures
        if config.closures and config.closures.edge_ids:
            closed_set = set(config.closures.edge_ids)
            edges_to_remove = []
            for u, v, data in sim_G.edges(data=True):
                eid = data.get("edge_id")
                if eid in closed_set:
                    edges_to_remove.append((u, v))
                    closed_edges.add(eid)

            for u, v in edges_to_remove:
                sim_G.remove_edge(u, v)

        # 2. Incidents (capacity and speed degradation)
        if config.incidents and config.incidents.edge_ids:
            incident_set = set(config.incidents.edge_ids)
            cap_factor = max(0.1, config.incidents.capacity_reduction_factor)
            spd_factor = max(0.1, config.incidents.speed_reduction_factor)

            for u, v, data in sim_G.edges(data=True):
                eid = data.get("edge_id")
                if eid in incident_set:
                    data["capacity_veh_hr"] = max(100.0, data["capacity_veh_hr"] * cap_factor)
                    data["speed_kmh"] = max(5.0, data["speed_kmh"] * spd_factor)
                    # Recompute free-flow time under degraded speed
                    speed_ms = data["speed_kmh"] / 3.6
                    data["free_flow_time_s"] = round(data["length"] / speed_ms, 2)
                    data["is_incident_edge"] = True

        # 3. Signal timing interventions (Webster intersection control delay)
        if config.signals:
            target_node = str(config.signals.intersection_node_id)
            cycle = float(config.signals.cycle_time_s)
            split = float(config.signals.green_split_ratio)

            for u, v, data in sim_G.edges(data=True):
                # An approach edge is one whose destination (v) is the signalized intersection
                if str(v) == target_node:
                    base_cap = data.get("capacity_veh_hr", 1800.0)
                    data["base_capacity_veh_hr"] = base_cap
                    data["capacity_veh_hr"] = self.webster.calculate_effective_capacity(base_cap, split)
                    data["signal_cycle_s"] = cycle
                    data["signal_split"] = split
                    data["is_signal_approach"] = True

        return sim_G, closed_edges

    def run(self, config: ScenarioConfig) -> SimulationResult:
        """Executes the graph simulation and computes metrics."""
        t_start = time.time()

        # 1. Load baseline network
        G, net_metadata = self.network_loader.load_network(config.network_id)

        # 2. Apply interventions
        sim_G, closed_edges = self._prepare_simulation_graph(G, config)

        # 3. Generate synthetic vehicle trips
        from ..demand_generator import SyntheticDemandGenerator
        demand_gen = SyntheticDemandGenerator(seed=config.demand.seed)
        vehicle_trips_demand = demand_gen.generate_demand(G, config.demand)

        # 4. Simulation state tracking
        duration_hours = max(0.01, config.demand.duration_seconds / 3600.0)
        edge_volume_counts: Dict[tuple, int] = {e: 0 for e in sim_G.edges}
        trip_records: List[VehicleTripRecord] = []
        routing_failures = 0

        # Initial link weights: free-flow time
        for u, v, d in sim_G.edges(data=True):
            d["current_weight"] = d.get("free_flow_time_s", 10.0)

        # 5. Route vehicles chronologically with dynamic congestion feedback
        for demand in vehicle_trips_demand:
            origin = str(demand.origin_node)
            dest = str(demand.destination_node)

            if origin not in sim_G or dest not in sim_G:
                routing_failures += 1
                trip_records.append(
                    VehicleTripRecord(
                        vehicle_id=demand.vehicle_id,
                        origin_node=origin,
                        destination_node=dest,
                        departure_time_s=demand.departure_time_s,
                        completed=False,
                    )
                )
                continue

            try:
                # Dijkstra shortest path using current dynamic weight
                path_nodes = nx.shortest_path(sim_G, source=origin, target=dest, weight="current_weight")
                path_edges = list(zip(path_nodes[:-1], path_nodes[1:]))

                # Accumulate trip distance and travel time along path
                trip_distance = 0.0
                trip_travel_time = 0.0
                trip_free_flow_time = 0.0

                for u, v in path_edges:
                    edata = sim_G[u][v]
                    edge_volume_counts[(u, v)] = edge_volume_counts.get((u, v), 0) + 1
                    vol = edge_volume_counts[(u, v)]

                    # Compute current hourly volume rate for this edge
                    hourly_vol = vol / duration_hours
                    cap = edata.get("capacity_veh_hr", 1800.0)
                    ff_time = edata.get("free_flow_time_s", 10.0)

                    actual_edge_time = self.bpr.calculate_travel_time(ff_time, hourly_vol, cap)

                    # Webster signal control delay if approach to signalized intersection
                    if edata.get("is_signal_approach"):
                        cycle = edata.get("signal_cycle_s", 90.0)
                        split = edata.get("signal_split", 0.5)
                        base_c = edata.get("base_capacity_veh_hr", 1800.0)
                        sig_delay, _, _ = self.webster.calculate_control_delay(
                            cycle_time_s=cycle,
                            green_split_ratio=split,
                            hourly_volume=hourly_vol,
                            base_capacity_veh_hr=base_c,
                            analysis_period_hours=duration_hours,
                        )
                        actual_edge_time += sig_delay

                    # Incident physical queuing delay under oversaturated bottlenecks
                    if edata.get("is_incident_edge") and hourly_vol > cap:
                        oversat_ratio = (hourly_vol - cap) / max(1.0, cap)
                        queue_delay = round(min(1800.0, oversat_ratio * ff_time * 4.0), 2)
                        actual_edge_time += queue_delay

                    trip_distance += edata.get("length", 0.0)
                    trip_travel_time += actual_edge_time
                    trip_free_flow_time += ff_time

                    # Update current link impedance for subsequent vehicles
                    edata["current_weight"] = actual_edge_time

                arrival_time = demand.departure_time_s + trip_travel_time
                trip_delay = max(0.0, trip_travel_time - trip_free_flow_time)

                trip_records.append(
                    VehicleTripRecord(
                        vehicle_id=demand.vehicle_id,
                        origin_node=origin,
                        destination_node=dest,
                        departure_time_s=demand.departure_time_s,
                        arrival_time_s=round(arrival_time, 2),
                        travel_time_s=round(trip_travel_time, 2),
                        waiting_time_s=round(trip_delay, 2),
                        distance_m=round(trip_distance, 2),
                        route_node_count=len(path_nodes),
                        completed=True,
                    )
                )

            except (nx.NetworkXNoPath, nx.NodeNotFound):
                routing_failures += 1
                trip_records.append(
                    VehicleTripRecord(
                        vehicle_id=demand.vehicle_id,
                        origin_node=origin,
                        destination_node=dest,
                        departure_time_s=demand.departure_time_s,
                        completed=False,
                    )
                )

        # 6. Aggregate edge-level metrics
        edge_metrics: Dict[str, EdgeMetricRecord] = {}
        for u, v, d in G.edges(data=True):
            eid = d.get("edge_id", f"{u}_{v}_0")
            length_m = d.get("length", 10.0)
            ff_time = d.get("free_flow_time_s", 10.0)
            cap = d.get("capacity_veh_hr", 1800.0)

            if eid in closed_edges:
                edge_metrics[eid] = EdgeMetricRecord(
                    edge_id=eid,
                    length_m=length_m,
                    free_flow_time_s=ff_time,
                    actual_travel_time_s=999999.0,
                    volume_veh=0,
                    capacity_veh_hr=0.0,
                    volume_to_capacity_ratio=0.0,
                    average_speed_kmh=0.0,
                    congested=False,
                    closed=True,
                )
            else:
                vol = edge_volume_counts.get((u, v), 0)
                hourly_vol = vol / duration_hours
                actual_time, delay, eff_spd, vc_ratio = self.bpr.calculate_metrics(length_m, ff_time, hourly_vol, cap)

                # Add signal control delay if approach edge
                if d.get("is_signal_approach"):
                    cycle = d.get("signal_cycle_s", 90.0)
                    split = d.get("signal_split", 0.5)
                    base_c = d.get("base_capacity_veh_hr", 1800.0)
                    sig_del, _, _ = self.webster.calculate_control_delay(cycle, split, hourly_vol, base_c, duration_hours)
                    actual_time = round(actual_time + sig_del, 2)
                    delay = round(delay + sig_del, 2)
                    eff_spd = round((length_m / max(0.1, actual_time)) * 3.6, 1)

                # Add incident queuing delay if bottleneck oversaturated
                if d.get("is_incident_edge") and hourly_vol > cap:
                    oversat_ratio = (hourly_vol - cap) / max(1.0, cap)
                    q_del = round(min(1800.0, oversat_ratio * ff_time * 4.0), 2)
                    actual_time = round(actual_time + q_del, 2)
                    delay = round(delay + q_del, 2)
                    eff_spd = round((length_m / max(0.1, actual_time)) * 3.6, 1)

                edge_metrics[eid] = EdgeMetricRecord(
                    edge_id=eid,
                    length_m=length_m,
                    free_flow_time_s=ff_time,
                    actual_travel_time_s=actual_time,
                    volume_veh=vol,
                    capacity_veh_hr=cap,
                    volume_to_capacity_ratio=vc_ratio,
                    average_speed_kmh=eff_spd,
                    congested=vc_ratio >= 0.85 or delay > 30.0,
                    closed=False,
                )

        # 7. Compute global summary metrics
        completed_trips = [t for t in trip_records if t.completed]
        num_completed = len(completed_trips)

        if num_completed > 0:
            avg_travel_time = round(sum(t.travel_time_s for t in completed_trips) / num_completed, 2)
            avg_waiting_time = round(sum(t.waiting_time_s for t in completed_trips) / num_completed, 2)
            avg_distance = round(sum(t.distance_m for t in completed_trips) / num_completed, 2)
        else:
            avg_travel_time = 0.0
            avg_waiting_time = 0.0
            avg_distance = 0.0

        throughput = round(num_completed / duration_hours, 1)

        # Active vehicles (started before end of duration but finishes after duration)
        active_vehicles = sum(
            1 for t in completed_trips
            if t.departure_time_s <= config.demand.duration_seconds < (t.arrival_time_s or 0.0)
        )

        metrics = SimulationMetrics(
            completed_trips=MetricItem(
                value=float(num_completed),
                unit="trips",
                available=True,
                description="Total vehicles that successfully reached their destination.",
            ),
            avg_travel_time_s=MetricItem(
                value=avg_travel_time,
                unit="seconds",
                available=True,
                description="Mean trip travel time across all completed vehicles.",
            ),
            avg_waiting_time_s=MetricItem(
                value=avg_waiting_time,
                unit="seconds",
                available=True,
                description="Mean delay caused by congestion above free-flow travel time.",
            ),
            avg_distance_m=MetricItem(
                value=avg_distance,
                unit="meters",
                available=True,
                description="Average traveled route distance per vehicle.",
            ),
            throughput_veh_per_hr=MetricItem(
                value=throughput,
                unit="veh/hr",
                available=True,
                description="Vehicles completing their trips per hour of simulation duration.",
            ),
            active_vehicles=MetricItem(
                value=float(active_vehicles),
                unit="vehicles",
                available=True,
                description="Vehicles still en route at the simulation end time.",
            ),
            routing_failures=MetricItem(
                value=float(routing_failures),
                unit="vehicles",
                available=True,
                description="Vehicles unable to find a connected route to destination.",
            ),
            simulation_duration_s=MetricItem(
                value=float(config.demand.duration_seconds),
                unit="seconds",
                available=True,
                description="Configured total simulation duration in seconds.",
            ),
        )

        elapsed = round(time.time() - t_start, 3)

        assumptions = [
            f"BPR link performance function applied with alpha={self.bpr.alpha}, beta={self.bpr.beta}.",
            "Dynamic shortest path routing updated with accumulated edge volumes.",
            f"Seed {config.demand.seed} used for deterministic demand generation.",
            "Capacity formula: lanes * 1800 veh/hr/lane.",
        ]

        if config.signals:
            assumptions.append(
                f"Webster signal control model active at node '{config.signals.intersection_node_id}' "
                f"(Cycle={config.signals.cycle_time_s}s, GreenSplit={config.signals.green_split_ratio})."
            )

        if config.incidents:
            assumptions.append(
                f"Incident queue bottleneck model active on {len(config.incidents.edge_ids)} segment(s) "
                f"(CapFactor={config.incidents.capacity_reduction_factor}, SpeedFactor={config.incidents.speed_reduction_factor})."
            )

        warnings: List[str] = []
        if routing_failures > 0:
            warnings.append(f"{routing_failures} trips experienced routing failures due to network disconnects or closures.")

        return SimulationResult(
            run_id=f"run_{int(time.time())}_{config.demand.seed}_{uuid.uuid4().hex[:6]}",
            scenario_config=config,
            engine_id=self.ENGINE_ID,
            engine_version=self.ENGINE_VERSION,
            network_id=config.network_id,
            seed=config.demand.seed,
            status="completed",
            metrics=metrics,
            edge_metrics=edge_metrics,
            sample_trips=trip_records[:50],  # Persist sample of trips for inspection
            assumptions=assumptions,
            warnings=warnings,
            data_label="SIMULATED",
            execution_time_seconds=elapsed,
        )
