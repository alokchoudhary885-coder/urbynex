"""
backend/tests/unit/test_webster.py

Unit tests for Webster's Traffic Signal Delay Model (M3.1/M3.2).
Validates uniform delay d1, incremental overflow delay d2, and effective capacity calculation.
"""

import pytest
from backend.simulation.engines.webster import WebsterSignalDelay


@pytest.fixture
def webster():
    return WebsterSignalDelay(default_cycle_time_s=90.0)


def test_calculate_effective_capacity_scaling(webster):
    """Effective capacity scales directly with green split ratio."""
    base_cap = 1800.0  # 1 lane saturation flow rate

    cap_half = webster.calculate_effective_capacity(base_cap, 0.5)
    assert cap_half == 900.0

    cap_low = webster.calculate_effective_capacity(base_cap, 0.25)
    assert cap_low == 450.0

    cap_high = webster.calculate_effective_capacity(base_cap, 0.75)
    assert cap_high == 1350.0


def test_effective_capacity_clamped_bounds(webster):
    """Green split is safely clamped within physically valid limits."""
    cap_zero = webster.calculate_effective_capacity(1800.0, 0.0)
    assert cap_zero >= 50.0

    cap_over = webster.calculate_effective_capacity(1800.0, 1.5)
    assert cap_over <= 1800.0 * 0.95


def test_uniform_delay_increases_with_cycle_length(webster):
    """Longer cycle times create higher uniform vehicle delay d1."""
    d_short, d1_short, _ = webster.calculate_control_delay(
        cycle_time_s=60.0,
        green_split_ratio=0.5,
        hourly_volume=300.0,
        base_capacity_veh_hr=1800.0,
    )
    d_long, d1_long, _ = webster.calculate_control_delay(
        cycle_time_s=120.0,
        green_split_ratio=0.5,
        hourly_volume=300.0,
        base_capacity_veh_hr=1800.0,
    )

    assert d_short > 0.0
    assert d_long > d_short
    assert d1_long > d1_short


def test_higher_green_split_reduces_delay(webster):
    """Allocating more green time to an approach significantly reduces control delay."""
    d_low_split, _, _ = webster.calculate_control_delay(
        cycle_time_s=90.0,
        green_split_ratio=0.3,
        hourly_volume=400.0,
        base_capacity_veh_hr=1800.0,
    )
    d_high_split, _, _ = webster.calculate_control_delay(
        cycle_time_s=90.0,
        green_split_ratio=0.7,
        hourly_volume=400.0,
        base_capacity_veh_hr=1800.0,
    )

    assert d_low_split > d_high_split


def test_incremental_delay_kicks_in_near_capacity(webster):
    """When degree of saturation X > 0.8, incremental overflow delay d2 is added."""
    # c_eff = 1800 * 0.5 = 900 veh/hr
    # v = 300 -> X = 0.33 (uncongested)
    _, _, d2_uncongested = webster.calculate_control_delay(
        cycle_time_s=90.0,
        green_split_ratio=0.5,
        hourly_volume=300.0,
        base_capacity_veh_hr=1800.0,
    )
    assert d2_uncongested == 0.0

    # v = 850 -> X = 850/900 = 0.94 (congested)
    d_cong, _, d2_congested = webster.calculate_control_delay(
        cycle_time_s=90.0,
        green_split_ratio=0.5,
        hourly_volume=850.0,
        base_capacity_veh_hr=1800.0,
    )
    assert d2_congested > 0.0
    assert d_cong > d2_congested
