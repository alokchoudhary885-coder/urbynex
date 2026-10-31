"""
Urbynex - Traffic Data Ingestion Base Contracts and Data Quality Models.
Implements M3.4 and M4.3 specifications for historical traffic observation schema,
validation rules, and data quality metrics.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Set, Union
from pathlib import Path
import io


@dataclass
class TrafficObservation:
    """A single spatio-temporal traffic measurement on a network edge."""
    timestamp: datetime
    edge_id: str
    speed_kmh: float
    volume_veh_per_hr: float
    occupancy_pct: Optional[float] = None


@dataclass
class DataQualityReport:
    """Comprehensive data quality evaluation for imported datasets."""
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    duplicate_rows: int = 0
    unmapped_edges_count: int = 0
    completeness_pct: float = 0.0
    min_timestamp: Optional[str] = None
    max_timestamp: Optional[str] = None
    speed_outliers_count: int = 0
    issues: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "invalid_rows": self.invalid_rows,
            "duplicate_rows": self.duplicate_rows,
            "unmapped_edges_count": self.unmapped_edges_count,
            "completeness_pct": round(self.completeness_pct, 2),
            "min_timestamp": self.min_timestamp,
            "max_timestamp": self.max_timestamp,
            "speed_outliers_count": self.speed_outliers_count,
            "issues": self.issues[:20],  # cap issue log to top 20
        }


@dataclass
class HourlyProfile:
    """Aggregated traffic flow factor and speed profile for a specific hour of day."""
    hour: int  # 0 to 23
    avg_speed_kmh: float
    total_volume: float
    sample_count: int
    flow_factor: float  # Multiplier relative to 24-hr mean flow (for demand scaling)

    def to_dict(self) -> dict:
        return {
            "hour": self.hour,
            "avg_speed_kmh": round(self.avg_speed_kmh, 2),
            "total_volume": round(self.total_volume, 1),
            "sample_count": self.sample_count,
            "flow_factor": round(self.flow_factor, 3),
        }


@dataclass
class HistoricalDataset:
    """Validated historical traffic dataset container."""
    source_name: str
    observations: List[TrafficObservation]
    quality_report: DataQualityReport
    hourly_profiles: Dict[int, HourlyProfile]
    edge_mean_speeds: Dict[str, float]
    edge_mean_volumes: Dict[str, float]

    def to_dict(self) -> dict:
        return {
            "source_name": self.source_name,
            "observation_count": len(self.observations),
            "quality_report": self.quality_report.to_dict(),
            "hourly_profiles": {str(h): p.to_dict() for h, p in self.hourly_profiles.items()},
            "mapped_edges_count": len(self.edge_mean_speeds),
        }


class ProviderStatus(str, Enum):
    AVAILABLE = "available"
    CREDENTIALS_MISSING = "credentials_missing"
    UNREACHABLE = "unreachable"
    RATE_LIMITED = "rate_limited"


@dataclass
class LiveProviderStatusInfo:
    provider_name: str
    status: ProviderStatus
    is_live: bool
    coverage_area: str
    message: str
    last_checked_at: str

    def to_dict(self) -> dict:
        return {
            "provider_name": self.provider_name,
            "status": self.status.value,
            "is_live": self.is_live,
            "coverage_area": self.coverage_area,
            "message": self.message,
            "last_checked_at": self.last_checked_at,
        }


class BaseHistoricalTrafficAdapter(ABC):
    """Abstract base adapter for loading and validating historical traffic datasets."""

    @abstractmethod
    def parse(
        self,
        content: Union[str, bytes, Path, io.StringIO, io.TextIOBase],
        source_name: str = "dataset",
        known_network_edges: Optional[Set[str]] = None,
    ) -> HistoricalDataset:
        """Parse source data into a validated HistoricalDataset."""
        pass
