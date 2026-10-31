"""
Urbynex - Historical JSON Traffic Data Ingestion Adapter.
Parses JSON traffic observation payloads, validates structure, applies
boundary checks, and computes data quality metrics and hourly flow profiles.
"""
from __future__ import annotations

import io
import json
import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Union

from backend.data.adapters.base import (
    BaseHistoricalTrafficAdapter,
    DataQualityReport,
    HistoricalDataset,
    HourlyProfile,
    TrafficObservation,
)

logger = logging.getLogger(__name__)


class HistoricalJsonAdapter(BaseHistoricalTrafficAdapter):
    """
    Parser and validator for JSON traffic payloads adhering to docs/DATA_SOURCES.md schema.
    """

    def parse(
        self,
        content: Union[str, bytes, Path, io.StringIO, io.TextIOBase],
        source_name: str = "json_dataset",
        known_network_edges: Optional[Set[str]] = None,
    ) -> HistoricalDataset:
        raw_text = self._read_text(content)
        try:
            payload = json.loads(raw_text)
        except Exception as e:
            report = DataQualityReport(
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                issues=[f"Invalid JSON payload: {str(e)}"],
            )
            return HistoricalDataset(
                source_name=source_name,
                observations=[],
                quality_report=report,
                hourly_profiles={},
                edge_mean_speeds={},
                edge_mean_volumes={},
            )

        if isinstance(payload, dict):
            source_label = payload.get("source", source_name)
            raw_observations = payload.get("observations", [])
            if not isinstance(raw_observations, list):
                report = DataQualityReport(
                    total_rows=0,
                    valid_rows=0,
                    invalid_rows=0,
                    issues=["JSON 'observations' key must be an array."],
                )
                return HistoricalDataset(
                    source_name=source_label,
                    observations=[],
                    quality_report=report,
                    hourly_profiles={},
                    edge_mean_speeds={},
                    edge_mean_volumes={},
                )
        elif isinstance(payload, list):
            source_label = source_name
            raw_observations = payload
        else:
            report = DataQualityReport(
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                issues=["JSON payload must be a dict or list."],
            )
            return HistoricalDataset(
                source_name=source_name,
                observations=[],
                quality_report=report,
                hourly_profiles={},
                edge_mean_speeds={},
                edge_mean_volumes={},
            )

        total_rows = len(raw_observations)
        valid_rows = 0
        invalid_rows = 0
        duplicate_rows = 0
        speed_outliers_count = 0
        issues: List[str] = []

        seen_keys: Set[tuple] = set()
        unmapped_edges: Set[str] = set()
        observations: List[TrafficObservation] = []

        min_ts: Optional[datetime] = None
        max_ts: Optional[datetime] = None

        edge_speed_sums: Dict[str, float] = defaultdict(float)
        edge_volume_sums: Dict[str, float] = defaultdict(float)
        edge_counts: Dict[str, int] = defaultdict(int)

        hourly_vols: Dict[int, List[float]] = defaultdict(list)
        hourly_speeds: Dict[int, List[float]] = defaultdict(list)

        for idx, item in enumerate(raw_observations, start=1):
            if not isinstance(item, dict):
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Observation #{idx}: item must be an object")
                continue

            raw_ts = item.get("timestamp")
            raw_edge = item.get("edge_id")
            raw_speed = item.get("speed_kmh")
            raw_vol = item.get("volume_veh_per_hr")
            raw_occ = item.get("occupancy_pct")

            if not raw_ts or not isinstance(raw_ts, str):
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Observation #{idx}: missing string 'timestamp'")
                continue

            try:
                ts_str = raw_ts[:-1] + "+00:00" if raw_ts.endswith("Z") else raw_ts
                parsed_ts = datetime.fromisoformat(ts_str)
            except Exception as e:
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Observation #{idx}: invalid timestamp format '{raw_ts}' ({e})")
                continue

            edge_str = str(raw_edge).strip() if raw_edge is not None else ""
            if not edge_str:
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Observation #{idx}: missing 'edge_id'")
                continue

            if known_network_edges is not None and edge_str not in known_network_edges:
                unmapped_edges.add(edge_str)

            try:
                speed_val = float(raw_speed)
                if speed_val < 0.0 or speed_val > 200.0:
                    speed_outliers_count += 1
                    invalid_rows += 1
                    if len(issues) < 20:
                        issues.append(f"Observation #{idx}: speed {speed_val} km/h is outside valid 0-200 range")
                    continue
            except (ValueError, TypeError):
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Observation #{idx}: invalid speed '{raw_speed}'")
                continue

            try:
                vol_val = float(raw_vol)
                if vol_val < 0.0:
                    invalid_rows += 1
                    if len(issues) < 20:
                        issues.append(f"Observation #{idx}: volume {vol_val} must be non-negative")
                    continue
            except (ValueError, TypeError):
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Observation #{idx}: invalid volume '{raw_vol}'")
                continue

            occ_val: Optional[float] = None
            if raw_occ is not None:
                try:
                    occ_val = float(raw_occ)
                    if not (0.0 <= occ_val <= 1.0):
                        invalid_rows += 1
                        if len(issues) < 20:
                            issues.append(f"Observation #{idx}: occupancy {occ_val} must be between 0.0 and 1.0")
                        continue
                except (ValueError, TypeError):
                    invalid_rows += 1
                    if len(issues) < 20:
                        issues.append(f"Observation #{idx}: invalid occupancy '{raw_occ}'")
                    continue

            dedup_key = (parsed_ts.isoformat(), edge_str)
            if dedup_key in seen_keys:
                duplicate_rows += 1
                continue
            seen_keys.add(dedup_key)

            obs = TrafficObservation(
                timestamp=parsed_ts,
                edge_id=edge_str,
                speed_kmh=speed_val,
                volume_veh_per_hr=vol_val,
                occupancy_pct=occ_val,
            )
            observations.append(obs)
            valid_rows += 1

            if min_ts is None or parsed_ts < min_ts:
                min_ts = parsed_ts
            if max_ts is None or parsed_ts > max_ts:
                max_ts = parsed_ts

            edge_speed_sums[edge_str] += speed_val
            edge_volume_sums[edge_str] += vol_val
            edge_counts[edge_str] += 1

            hour_of_day = parsed_ts.hour
            hourly_vols[hour_of_day].append(vol_val)
            hourly_speeds[hour_of_day].append(speed_val)

        overall_total_volume = sum(obs.volume_veh_per_hr for obs in observations)
        active_hours = len(hourly_vols)
        mean_hourly_vol = (overall_total_volume / active_hours) if active_hours > 0 else 1.0

        hourly_profiles: Dict[int, HourlyProfile] = {}
        for h in range(24):
            vols = hourly_vols.get(h, [])
            speeds = hourly_speeds.get(h, [])
            if vols:
                avg_speed = sum(speeds) / len(speeds)
                tot_vol = sum(vols)
                factor = (tot_vol / len(vols)) / mean_hourly_vol if mean_hourly_vol > 0 else 1.0
                hourly_profiles[h] = HourlyProfile(
                    hour=h,
                    avg_speed_kmh=avg_speed,
                    total_volume=tot_vol,
                    sample_count=len(vols),
                    flow_factor=factor,
                )

        edge_mean_speeds = {
            edge: (edge_speed_sums[edge] / edge_counts[edge]) for edge in edge_counts
        }
        edge_mean_volumes = {
            edge: (edge_volume_sums[edge] / edge_counts[edge]) for edge in edge_counts
        }

        completeness_pct = (valid_rows / total_rows * 100.0) if total_rows > 0 else 0.0

        report = DataQualityReport(
            total_rows=total_rows,
            valid_rows=valid_rows,
            invalid_rows=invalid_rows,
            duplicate_rows=duplicate_rows,
            unmapped_edges_count=len(unmapped_edges),
            completeness_pct=completeness_pct,
            min_timestamp=min_ts.isoformat() if min_ts else None,
            max_timestamp=max_ts.isoformat() if max_ts else None,
            speed_outliers_count=speed_outliers_count,
            issues=issues,
        )

        return HistoricalDataset(
            source_name=source_label,
            observations=observations,
            quality_report=report,
            hourly_profiles=hourly_profiles,
            edge_mean_speeds=edge_mean_speeds,
            edge_mean_volumes=edge_mean_volumes,
        )

    def _read_text(
        self, content: Union[str, bytes, Path, io.StringIO, io.TextIOBase]
    ) -> str:
        if isinstance(content, Path):
            return content.read_text(encoding="utf-8")
        if isinstance(content, bytes):
            return content.decode("utf-8")
        if isinstance(content, str):
            if "\n" not in content and Path(content).is_file():
                return Path(content).read_text(encoding="utf-8")
            return content
        return content.read()
