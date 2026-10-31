"""
backend/api/routes/data_ingestion.py

Routes for importing historical traffic data (CSV, JSON), evaluating data quality,
and checking live provider connection status.
"""
from typing import Optional, Set
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from ..dependencies import get_network_loader
from ...simulation.network_loader import NetworkLoader
from ...data.adapters import (
    HistoricalCsvAdapter,
    HistoricalJsonAdapter,
    LiveTrafficRegistry,
    HistoricalDataset,
)
from ..schemas.data_ingestion import (
    DataQualityReportSchema,
    HourlyProfileSchema,
    HistoricalImportResponse,
    LiveProviderStatusSchema,
    LiveProvidersListResponse,
)

router = APIRouter(prefix="/data", tags=["Data Ingestion & Quality"])
live_registry = LiveTrafficRegistry()


@router.get("/live/status", response_model=LiveProvidersListResponse)
def get_live_provider_status() -> LiveProvidersListResponse:
    """
    Returns connectivity and credential availability status for all supported live traffic providers.
    Adheres to the zero-fabrication principle: if credentials are not configured,
    the API transparently reports 'credentials_missing' rather than fabricating fake telemetry.
    """
    statuses = live_registry.get_all_statuses()
    items = [
        LiveProviderStatusSchema(
            provider_name=s.provider_name,
            status=s.status.value,
            is_live=s.is_live,
            coverage_area=s.coverage_area,
            message=s.message,
            last_checked_at=s.last_checked_at,
        )
        for s in statuses
    ]
    return LiveProvidersListResponse(
        providers=items,
        any_live=live_registry.is_any_live(),
    )


@router.post("/historical/upload", response_model=HistoricalImportResponse)
async def upload_historical_traffic(
    request: Request,
    network_id: Optional[str] = Query(default="jaipur_v1", description="Network to validate edge IDs against"),
    source_name: Optional[str] = Query(default=None, description="Dataset label"),
    format: Optional[str] = Query(default=None, description="Format override: 'csv' or 'json'"),
    loader: NetworkLoader = Depends(get_network_loader),
) -> HistoricalImportResponse:
    """
    Upload and validate historical traffic observation dataset in CSV or JSON format.
    Accepts raw CSV or JSON payloads in request body without requiring multipart dependencies.
    Computes data quality report, unmapped edge detection, outlier counts, and 24-hour flow factor profiles.
    """
    content_bytes = await request.body()
    if not content_bytes or not content_bytes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body cannot be empty.",
        )

    # Determine format: query param > content-type header > content sniffing
    content_type = request.headers.get("content-type", "").lower()
    text_preview = content_bytes[:100].strip()

    if format:
        is_json = format.lower() == "json"
    elif "json" in content_type:
        is_json = True
    elif text_preview.startswith(b"{") or text_preview.startswith(b"["):
        is_json = True
    else:
        is_json = False

    adapter = HistoricalJsonAdapter() if is_json else HistoricalCsvAdapter()
    format_type = "JSON" if is_json else "CSV"
    label = source_name or f"historical_{format_type.lower()}_upload"

    # Resolve known network edges for topology alignment
    known_edges: Optional[Set[str]] = None
    if network_id:
        try:
            G, _ = loader.load_network(network_id)
            known_edges = set()
            for u, v, k, data in G.edges(keys=True, data=True):
                eid = data.get("edge_id", f"{u}_{v}_{k}")
                known_edges.add(str(eid))
        except Exception:
            # Network not found on disk; proceed without edge validation
            known_edges = None

    dataset: HistoricalDataset = adapter.parse(
        content=content_bytes,
        source_name=label,
        known_network_edges=known_edges,
    )

    qr = dataset.quality_report
    quality_schema = DataQualityReportSchema(
        total_rows=qr.total_rows,
        valid_rows=qr.valid_rows,
        invalid_rows=qr.invalid_rows,
        duplicate_rows=qr.duplicate_rows,
        unmapped_edges_count=qr.unmapped_edges_count,
        completeness_pct=qr.completeness_pct,
        min_timestamp=qr.min_timestamp,
        max_timestamp=qr.max_timestamp,
        speed_outliers_count=qr.speed_outliers_count,
        issues=qr.issues,
    )

    hourly_schemas = {
        str(h): HourlyProfileSchema(
            hour=p.hour,
            avg_speed_kmh=p.avg_speed_kmh,
            total_volume=p.total_volume,
            sample_count=p.sample_count,
            flow_factor=p.flow_factor,
        )
        for h, p in dataset.hourly_profiles.items()
    }

    return HistoricalImportResponse(
        source_name=dataset.source_name,
        format=format_type,
        observation_count=len(dataset.observations),
        quality_report=quality_schema,
        hourly_profiles=hourly_schemas,
        mapped_edges_count=len(dataset.edge_mean_speeds),
    )

