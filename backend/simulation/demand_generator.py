"""
backend/simulation/demand_generator.py

Generates reproducible synthetic vehicle travel demand (Origin-Destination pairs
and departure schedules) across validated road networks.
"""

import math
import random
from typing import List, Tuple
import networkx as nx
from pydantic import BaseModel
from .engines.base import DemandConfig, DemandProfile


class VehicleDemand(BaseModel):
    """Synthetic vehicle trip demand specification."""
    vehicle_id: str
    origin_node: str
    destination_node: str
    departure_time_s: float
    vehicle_type: str = "car"


class SyntheticDemandGenerator:
    """
    Generates deterministic synthetic vehicle trips for simulation runs.
    Uses seeded pseudo-random number generator for reproducibility.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)

    def generate_demand(self, G: nx.DiGraph, config: DemandConfig) -> List[VehicleDemand]:
        """
        Generates vehicle demand trips across nodes of the graph.
        Guarantees that origin and destination are distinct and selected from
        the strongly connected graph nodes.
        """
        # Reset RNG with scenario seed
        self.rng = random.Random(config.seed)

        nodes = list(G.nodes)
        if len(nodes) < 2:
            raise ValueError("Graph must contain at least 2 nodes to generate demand trips.")

        trips: List[VehicleDemand] = []
        duration = float(config.duration_seconds)

        for i in range(config.vehicle_count):
            vid = f"veh_{i + 1:05d}"

            # Pick distinct origin and destination
            origin = self.rng.choice(nodes)
            destination = self.rng.choice(nodes)
            attempts = 0
            while destination == origin and attempts < 10:
                destination = self.rng.choice(nodes)
                attempts += 1

            # Departure time distribution
            if config.demand_profile == DemandProfile.UNIFORM:
                dep_time = self.rng.uniform(0.0, duration)
            elif config.demand_profile == DemandProfile.MORNING_PEAK:
                # Bell curve centered around 30% of duration (peak arrival)
                mu = duration * 0.35
                sigma = duration * 0.18
                raw_dep = self.rng.gauss(mu, sigma)
                dep_time = max(0.0, min(duration, raw_dep))
            elif config.demand_profile == DemandProfile.EVENING_PEAK:
                mu = duration * 0.65
                sigma = duration * 0.18
                raw_dep = self.rng.gauss(mu, sigma)
                dep_time = max(0.0, min(duration, raw_dep))
            else:
                dep_time = self.rng.uniform(0.0, duration)

            trips.append(
                VehicleDemand(
                    vehicle_id=vid,
                    origin_node=origin,
                    destination_node=destination,
                    departure_time_s=round(dep_time, 2),
                    vehicle_type="car",
                )
            )

        # Sort trips by departure time for chronological simulation execution
        trips.sort(key=lambda t: t.departure_time_s)
        return trips
