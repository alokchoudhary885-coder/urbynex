"""
Urbynex - Data Ingestion API Schemas (Pydantic v2).
"""
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class DataQualityReportSchema(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    unmapped_edges_count: int
    completeness_pct: float
    min_timestamp: Optional[str] = None
    max_timestamp: Optional[str] = None
    speed_outliers_count: int = 0
    issues: List[str] = Field(default_factory=list)


class HourlyProfileSchema(BaseModel):
    hour: int
    avg_speed_kmh: float
    total_volume: float
    sample_count: int
    flow_factor: float


class HistoricalImportResponse(BaseModel):
    source_name: str
    format: str
    observation_count: int
    quality_report: DataQualityReportSchema
    hourly_profiles: Dict[str, HourlyProfileSchema]
    mapped_edges_count: int


class LiveProviderStatusSchema(BaseModel):
    provider_name: str
    status: str
    is_live: bool
    coverage_area: str
    message: str
    last_checked_at: str


class LiveProvidersListResponse(BaseModel):
    providers: List[LiveProviderStatusSchema]
    any_live: bool
