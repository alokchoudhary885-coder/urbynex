"""
backend/simulation/engines/webster.py

Webster's Traffic Signal Delay Model.
Implements intersection control delay calculations based on cycle length,
effective green split ratio, and approach saturation flow.

Mathematical formulation (Highway Capacity Manual / Webster):
    d = d1 + d2

Where:
    C       = Cycle length (seconds)
    lambda  = Green-to-cycle ratio (g / C)
    X       = Degree of saturation (v / c_eff), where c_eff = capacity * lambda
    d1      = Uniform delay (seconds/vehicle):
              d1 = 0.5 * C * (1 - lambda)^2 / (1 - min(X * lambda, 0.99))
    d2      = Incremental / overflow delay for congested approaches (seconds/vehicle):
              d2 = max(0.0, 900.0 * T * ((X - 1.0) + ((X - 1.0)**2 + (16.0 * X) / max(1.0, c_eff * T))**0.5))
              (with analysis period T = 1.0 hour)
"""

import math
from typing import Tuple


class WebsterSignalDelay:
    """
    Computes signalized intersection control delay and effective capacity.
    """

    def __init__(self, default_cycle_time_s: float = 90.0):
        self.default_cycle_time_s = float(default_cycle_time_s)

    def calculate_effective_capacity(
        self,
        base_capacity_veh_hr: float,
        green_split_ratio: float,
    ) -> float:
        """
        Calculates effective approach capacity adjusted for signal green time allocation.
        """
        # Ensure split is within valid physical range [0.05, 0.95]
        g_split = max(0.05, min(0.95, float(green_split_ratio)))
        effective_capacity = max(50.0, base_capacity_veh_hr * g_split)
        return round(effective_capacity, 1)

    def calculate_control_delay(
        self,
        cycle_time_s: float,
        green_split_ratio: float,
        hourly_volume: float,
        base_capacity_veh_hr: float,
        analysis_period_hours: float = 1.0,
    ) -> Tuple[float, float, float]:
        """
        Calculates signal control delay (d1 uniform, d2 incremental, d_total).

        Returns:
            Tuple of (total_delay_s, uniform_delay_s, overflow_delay_s)
        """
        C = max(30.0, min(240.0, float(cycle_time_s)))
        lam = max(0.05, min(0.95, float(green_split_ratio)))
        c_eff = self.calculate_effective_capacity(base_capacity_veh_hr, lam)

        v = max(0.0, float(hourly_volume))
        X = v / max(1.0, c_eff)  # degree of saturation

        # 1. Uniform delay (Webster term 1)
        denom = 1.0 - min(0.99, lam * X)
        if denom <= 0.01:
            denom = 0.01
        d1 = 0.5 * C * ((1.0 - lam) ** 2) / denom

        # 2. Incremental / overflow delay when approaching or exceeding capacity
        T = max(0.25, float(analysis_period_hours))
        if X > 0.8:
            term1 = X - 1.0
            term2 = math.sqrt(max(0.0, (X - 1.0) ** 2 + (16.0 * X) / (c_eff * T)))
            d2 = 900.0 * T * (term1 + term2)
        else:
            d2 = 0.0

        d_total = round(max(0.0, d1 + d2), 2)
        return d_total, round(d1, 2), round(d2, 2)
