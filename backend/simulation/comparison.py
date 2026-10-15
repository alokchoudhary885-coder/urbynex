"""
backend/simulation/comparison.py

Scenario Comparison Engine.
Compares a baseline simulation run against an intervention scenario run,
calculating exact absolute and percentage deltas with domain-intelligent
improvement vs deterioration classification and compatibility checks.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from .engines.base import SimulationResult


class MetricComparisonItem(BaseModel):
    """Comparative evaluation for a single traffic metric."""
    metric_name: str
    display_name: str
    unit: str
    baseline_value: float
    target_value: float
    absolute_diff: float
    percent_diff: Optional[float]
    direction: str  # "improved", "deteriorated", "unchanged", "neutral"
    interpretation: str


class ComparisonResult(BaseModel):
    """Full side-by-side comparison between baseline and intervention runs."""
    baseline_run_id: str
    target_run_id: str
    compatible: bool
    compatibility_warnings: List[str] = Field(default_factory=list)
    metrics: List[MetricComparisonItem]
    summary_verdict: str


# Domain knowledge defining whether higher or lower values represent improvement
# True = lower is better (e.g. travel time, delay, failures)
# False = higher is better (e.g. throughput, completed trips)
METRIC_IMPROVEMENT_RULES = {
    "avg_travel_time_s": {
        "lower_is_better": True,
        "display_name": "Average Travel Time",
        "better_text": "decreased, improving overall corridor travel speed",
        "worse_text": "increased, indicating elevated corridor congestion",
    },
    "avg_waiting_time_s": {
        "lower_is_better": True,
        "display_name": "Average Congestion Delay",
        "better_text": "decreased, reducing waiting delay at bottlenecks",
        "worse_text": "increased, indicating severe bottleneck delays",
    },
    "throughput_veh_per_hr": {
        "lower_is_better": False,
        "display_name": "Vehicle Throughput",
        "better_text": "increased, delivering higher network flow efficiency",
        "worse_text": "decreased, reflecting reduced network capacity",
    },
    "completed_trips": {
        "lower_is_better": False,
        "display_name": "Completed Trips",
        "better_text": "increased, accommodating more completed trips",
        "worse_text": "decreased, with fewer trips completing successfully",
    },
    "avg_distance_m": {
        "lower_is_better": True,
        "display_name": "Average Travel Distance",
        "better_text": "decreased, using more direct routing",
        "worse_text": "increased, reflecting circuitous diversion routing around closures",
    },
    "routing_failures": {
        "lower_is_better": True,
        "display_name": "Routing Failures",
        "better_text": "decreased, fewer stranded vehicles",
        "worse_text": "increased, more vehicles disconnected by network changes",
    },
    "active_vehicles": {
        "lower_is_better": True,
        "display_name": "Active Unfinished Vehicles",
        "better_text": "decreased, trips completed more promptly within window",
        "worse_text": "increased, more vehicles trapped in queue spillback",
    },
}


class ScenarioComparator:
    """Compares two compatible simulation results."""

    @staticmethod
    def compare(baseline: SimulationResult, target: SimulationResult) -> ComparisonResult:
        """Evaluates deltas and domain classification between baseline and target."""
        warnings: List[str] = []

        # Compatibility checks
        if baseline.network_id != target.network_id:
            warnings.append(
                f"Different road networks ({baseline.network_id} vs {target.network_id}). Results may not be directly comparable."
            )

        if baseline.engine_id != target.engine_id:
            warnings.append(
                f"Different simulation engines ({baseline.engine_id} vs {target.engine_id})."
            )

        base_dur = baseline.scenario_config.demand.duration_seconds
        target_dur = target.scenario_config.demand.duration_seconds
        if base_dur != target_dur:
            warnings.append(
                f"Different simulation durations ({base_dur}s vs {target_dur}s). Throughput and totals may differ."
            )

        compatible = len(warnings) == 0

        # Compare individual metrics
        base_m = baseline.metrics
        target_m = target.metrics
        items: List[MetricComparisonItem] = []

        metric_pairs = [
            ("avg_travel_time_s", base_m.avg_travel_time_s, target_m.avg_travel_time_s),
            ("avg_waiting_time_s", base_m.avg_waiting_time_s, target_m.avg_waiting_time_s),
            ("throughput_veh_per_hr", base_m.throughput_veh_per_hr, target_m.throughput_veh_per_hr),
            ("completed_trips", base_m.completed_trips, target_m.completed_trips),
            ("avg_distance_m", base_m.avg_distance_m, target_m.avg_distance_m),
            ("routing_failures", base_m.routing_failures, target_m.routing_failures),
            ("active_vehicles", base_m.active_vehicles, target_m.active_vehicles),
        ]

        improved_count = 0
        worsened_count = 0

        for key, b_item, t_item in metric_pairs:
            b_val = b_item.value
            t_val = t_item.value
            abs_diff = round(t_val - b_val, 2)

            if abs(b_val) > 0.0001:
                pct_diff = round((abs_diff / b_val) * 100.0, 1)
            else:
                pct_diff = None

            rule = METRIC_IMPROVEMENT_RULES.get(key, {})
            lower_is_better = rule.get("lower_is_better", True)
            disp_name = rule.get("display_name", key)

            if abs(abs_diff) < 0.01:
                direction = "unchanged"
                interp = f"{disp_name} remained virtually identical ({t_val} {b_item.unit})."
            elif lower_is_better:
                if abs_diff < 0:
                    direction = "improved"
                    improved_count += 1
                    interp = f"{disp_name} {rule.get('better_text')} ({abs_diff} {b_item.unit}, {pct_diff}%)."
                else:
                    direction = "deteriorated"
                    worsened_count += 1
                    interp = f"{disp_name} {rule.get('worse_text')} (+{abs_diff} {b_item.unit}, +{pct_diff}%)."
            else:
                if abs_diff > 0:
                    direction = "improved"
                    improved_count += 1
                    interp = f"{disp_name} {rule.get('better_text')} (+{abs_diff} {b_item.unit}, +{pct_diff}%)."
                else:
                    direction = "deteriorated"
                    worsened_count += 1
                    interp = f"{disp_name} {rule.get('worse_text')} ({abs_diff} {b_item.unit}, {pct_diff}%)."

            items.append(
                MetricComparisonItem(
                    metric_name=key,
                    display_name=disp_name,
                    unit=b_item.unit,
                    baseline_value=b_val,
                    target_value=t_val,
                    absolute_diff=abs_diff,
                    percent_diff=pct_diff,
                    direction=direction,
                    interpretation=interp,
                )
            )

        if worsened_count > improved_count:
            verdict = f"Overall performance deteriorated under the intervention ({worsened_count} metrics degraded vs {improved_count} improved)."
        elif improved_count > worsened_count:
            verdict = f"Overall performance improved under the intervention ({improved_count} metrics improved vs {worsened_count} degraded)."
        else:
            verdict = "Mixed outcome: trade-offs observed between travel time, distance, and throughput."

        return ComparisonResult(
            baseline_run_id=baseline.run_id,
            target_run_id=target.run_id,
            compatible=compatible,
            compatibility_warnings=warnings,
            metrics=items,
            summary_verdict=verdict,
        )
