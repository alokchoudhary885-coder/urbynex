"""
Urbynex - Historical CSV Traffic Data Ingestion Adapter.
Parses CSV traffic files, applies schema validation, deduplication,
boundary checks, and produces quality metrics and hourly flow profiles.
"""
from __future__ import annotations

import csv
import io
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


class HistoricalCsvAdapter(BaseHistoricalTrafficAdapter):
    """
    Parser and validator for historical traffic measurements in CSV format.
    Expected headers: timestamp, edge_id, speed_kmh, volume_veh_per_hr [, occupancy_pct]
    """

    def parse(
        self,
        content: Union[str, bytes, Path, io.StringIO, io.TextIOBase],
        source_name: str = "csv_dataset",
        known_network_edges: Optional[Set[str]] = None,
    ) -> HistoricalDataset:
        text_stream = self._resolve_text_stream(content)
        reader = csv.DictReader(text_stream)

        # Normalize fieldnames
        if not reader.fieldnames:
            report = DataQualityReport(
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                issues=["CSV file is empty or missing headers."],
            )
            return HistoricalDataset(
                source_name=source_name,
                observations=[],
                quality_report=report,
                hourly_profiles={},
                edge_mean_speeds={},
                edge_mean_volumes={},
            )

        field_map = {name.strip().lower(): name for name in reader.fieldnames}

        # Check required columns
        req_keys = ["timestamp", "edge_id", "speed_kmh", "volume_veh_per_hr"]
        missing = [k for k in req_keys if k not in field_map]
        if missing:
            report = DataQualityReport(
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                issues=[f"Missing required columns in CSV: {', '.join(missing)}"],
            )
            return HistoricalDataset(
                source_name=source_name,
                observations=[],
                quality_report=report,
                hourly_profiles={},
                edge_mean_speeds={},
                edge_mean_volumes={},
            )

        ts_col = field_map["timestamp"]
        edge_col = field_map["edge_id"]
        speed_col = field_map["speed_kmh"]
        vol_col = field_map["volume_veh_per_hr"]
        occ_col = field_map.get("occupancy_pct")

        total_rows = 0
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

        for row_idx, row in enumerate(reader, start=2):
            total_rows += 1
            raw_ts = row.get(ts_col, "").strip()
            raw_edge = row.get(edge_col, "").strip()
            raw_speed = row.get(speed_col, "").strip()
            raw_vol = row.get(vol_col, "").strip()
            raw_occ = row.get(occ_col, "").strip() if occ_col else None

            # 1. Parse timestamp
            try:
                # Handle standard ISO formats, including Z suffix
                if raw_ts.endswith("Z"):
                    raw_ts_norm = raw_ts[:-1] + "+00:00"
                else:
                    raw_ts_norm = raw_ts
                parsed_ts = datetime.fromisoformat(raw_ts_norm)
            except Exception as e:
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Row {row_idx}: invalid ISO 8601 timestamp '{raw_ts}' ({e})")
                continue

            # 2. Parse edge_id
            if not raw_edge:
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Row {row_idx}: missing edge_id")
                continue

            # Check network mapping if known edges are supplied
            if known_network_edges is not None and raw_edge not in known_network_edges:
                unmapped_edges.add(raw_edge)

            # 3. Parse speed
            try:
                speed_val = float(raw_speed)
                if speed_val < 0.0 or speed_val > 200.0:
                    speed_outliers_count += 1
                    invalid_rows += 1
                    if len(issues) < 20:
                        issues.append(f"Row {row_idx}: speed {speed_val} km/h is outside valid 0-200 range")
                    continue
            except ValueError:
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Row {row_idx}: non-numeric speed '{raw_speed}'")
                continue

            # 4. Parse volume
            try:
                vol_val = float(raw_vol)
                if vol_val < 0.0:
                    invalid_rows += 1
                    if len(issues) < 20:
                        issues.append(f"Row {row_idx}: volume {vol_val} veh/hr must be non-negative")
                    continue
            except ValueError:
                invalid_rows += 1
                if len(issues) < 20:
                    issues.append(f"Row {row_idx}: non-numeric volume '{raw_vol}'")
                continue

            # 5. Parse occupancy (optional)
            occ_val: Optional[float] = None
            if raw_occ is not None and raw_occ != "":
                try:
                    occ_val = float(raw_occ)
                    if not (0.0 <= occ_val <= 1.0):
                        invalid_rows += 1
                        if len(issues) < 20:
                            issues.append(f"Row {row_idx}: occupancy {occ_val} must be between 0.0 and 1.0")
                        continue
                except ValueError:
                    invalid_rows += 1
                    if len(issues) < 20:
                        issues.append(f"Row {row_idx}: non-numeric occupancy '{raw_occ}'")
                    continue

            # 6. Duplicate check (timestamp + edge_id)
            dedup_key = (parsed_ts.isoformat(), raw_edge)
            if dedup_key in seen_keys:
                duplicate_rows += 1
                continue
            seen_keys.add(dedup_key)

            # Record valid observation
            obs = TrafficObservation(
                timestamp=parsed_ts,
                edge_id=raw_edge,
                speed_kmh=speed_val,
                volume_veh_per_hr=vol_val,
                occupancy_pct=occ_val,
            )
            observations.append(obs)
            valid_rows += 1

            # Update bounds
            if min_ts is None or parsed_ts < min_ts:
                min_ts = parsed_ts
            if max_ts is None or parsed_ts > max_ts:
                max_ts = parsed_ts

            # Aggregates
            edge_speed_sums[raw_edge] += speed_val
            edge_volume_sums[raw_edge] += vol_val
            edge_counts[raw_edge] += 1

            hour_of_day = parsed_ts.hour
            hourly_vols[hour_of_day].append(vol_val)
            hourly_speeds[hour_of_day].append(speed_val)

        # Compute hourly profile and flow scaling factors
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
                # Flow factor relative to 24-hr mean hourly volume
                factor = (tot_vol / len(vols)) / mean_hourly_vol if mean_hourly_vol > 0 else 1.0
                hourly_profiles[h] = HourlyProfile(
                    hour=h,
                    avg_speed_kmh=avg_speed,
                    total_volume=tot_vol,
                    sample_count=len(vols),
                    flow_factor=factor,
                )

        # Edge means
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
            source_name=source_name,
            observations=observations,
            quality_report=report,
            hourly_profiles=hourly_profiles,
            edge_mean_speeds=edge_mean_speeds,
            edge_mean_volumes=edge_mean_volumes,
        )

    def _resolve_text_stream(
        self, content: Union[str, bytes, Path, io.StringIO, io.TextIOBase]
    ) -> io.TextIOBase:
        if isinstance(content, Path):
            return open(content, "r", encoding="utf-8")
        if isinstance(content, bytes):
            return io.StringIO(content.decode("utf-8"))
        if isinstance(content, str):
            # Check if it's a file path
            if "\n" not in content and Path(content).is_file():
                return open(content, "r", encoding="utf-8")
            return io.StringIO(content)
        return content
