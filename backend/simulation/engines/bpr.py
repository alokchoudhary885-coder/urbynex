"""
backend/simulation/engines/bpr.py

Bureau of Public Roads (BPR) link performance model.
Computes dynamic link travel time, congestion delay, and effective vehicle speeds
as a function of link flow volume and edge capacity.
"""

from typing import Tuple


class BPRLinkPerformance:
    """
    Standard Bureau of Public Roads (BPR) Link Travel-Time Function:
        t(v) = t0 * (1 + alpha * (v / c) ** beta)

    Where:
        t0    = Free-flow travel time (seconds)
        v     = Hourly vehicle volume flow rate (veh/hr)
        c     = Link capacity (veh/hr)
        alpha = Congestion coefficient (standard default = 0.15)
        beta  = Congestion exponent (standard default = 4.0)
    """

    def __init__(self, alpha: float = 0.15, beta: float = 4.0):
        self.alpha = float(alpha)
        self.beta = float(beta)

    def calculate_travel_time(
        self,
        free_flow_time_s: float,
        hourly_volume: float,
        capacity_veh_hr: float,
    ) -> float:
        """
        Calculates dynamic travel time on an edge given current volume and capacity.
        Returns travel time in seconds (always >= free_flow_time_s).
        """
        if free_flow_time_s <= 0.0:
            return 1.0

        if capacity_veh_hr <= 0.0:
            # Capacity 0 indicates blocked/closed edge
            return 999999.0

        vc_ratio = max(0.0, hourly_volume / capacity_veh_hr)
        travel_time = free_flow_time_s * (1.0 + self.alpha * (vc_ratio ** self.beta))
        return round(travel_time, 2)

    def calculate_metrics(
        self,
        length_m: float,
        free_flow_time_s: float,
        hourly_volume: float,
        capacity_veh_hr: float,
    ) -> Tuple[float, float, float, float]:
        """
        Calculates complete edge performance tuple:
        (actual_travel_time_s, delay_waiting_time_s, effective_speed_kmh, vc_ratio)
        """
        actual_time = self.calculate_travel_time(free_flow_time_s, hourly_volume, capacity_veh_hr)
        delay = max(0.0, round(actual_time - free_flow_time_s, 2))

        # Effective speed in km/h
        if actual_time > 0:
            speed_ms = length_m / actual_time
            effective_speed_kmh = round(speed_ms * 3.6, 1)
        else:
            effective_speed_kmh = 0.0

        vc_ratio = round(hourly_volume / max(1.0, capacity_veh_hr), 3)
        return actual_time, delay, effective_speed_kmh, vc_ratio
