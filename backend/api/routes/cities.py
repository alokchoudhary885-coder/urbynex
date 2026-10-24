"""
backend/api/routes/cities.py

Routes for retrieving supported cities, road network versions, GeoJSON layers, and road edges.
"""

from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, JSONResponse
from ..dependencies import get_repository, get_network_loader
from ..schemas.cities import (
    CityListResponse,
    CityResponse,
    EdgeListResponse,
    EdgeSummary,
    NetworkListResponse,
    NetworkResponse,
)
from ...db.repository import RunRepository
from ...simulation.network_loader import NetworkLoader

router = APIRouter(tags=["Cities & Road Networks"])


@router.get("/cities", response_model=CityListResponse)
def list_cities(repo: RunRepository = Depends(get_repository)) -> CityListResponse:
    """Lists all supported digital twin cities and their road network availability."""
    cities_data = repo.list_cities()

    # If DB hasn't been synced yet, discover networks from disk
    if not cities_data:
        loader = NetworkLoader()
        available = loader.list_available_networks()
        for net_meta in available:
            repo.sync_network_metadata(net_meta)
        cities_data = repo.list_cities()

    items = [CityResponse(**c) for c in cities_data]
    return CityListResponse(cities=items)


@router.get("/cities/{city_id}/networks", response_model=NetworkListResponse)
def list_city_networks(
    city_id: str,
    repo: RunRepository = Depends(get_repository),
) -> NetworkListResponse:
    """Lists available road network versions for a given city."""
    networks = repo.list_networks(city_id=city_id)
    if not networks:
        # Check if any network exists on disk for this city
        loader = NetworkLoader()
        available = loader.list_available_networks()
        for net_meta in available:
            if net_meta.get("city_id") == city_id:
                repo.sync_network_metadata(net_meta)
        networks = repo.list_networks(city_id=city_id)

    if not networks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"City '{city_id}' not found or has no registered networks.",
        )

    items = []
    for net in networks:
        meta = net.metadata_json or {}
        items.append(
            NetworkResponse(
                network_id=net.network_id,
                city_id=net.city_id,
                version=net.version or "v1",
                description=net.corridor,
                bbox=meta.get("bbox", {}),
                node_count=net.node_count,
                edge_count=net.edge_count,
                total_road_length_km=net.total_road_length_km,
                source=meta.get("source", "OpenStreetMap contributors"),
                license=meta.get("license", "Open Database License (ODbL) 1.0"),
                imported_at=meta.get("imported_at"),
                validation_status=net.validation_status or "passed",
                simulation_ready=net.simulation_ready,
                sha256_hash=net.sha256_hash,
            )
        )
    return NetworkListResponse(networks=items)


@router.get("/networks/{network_id}/geojson")
def get_network_geojson(
    network_id: str,
    loader: NetworkLoader = Depends(get_network_loader),
):
    """
    Returns actual stored GeoJSON features of the road network for MapLibre map visualization.
    """
    geojson_path = loader.get_network_geojson_path(network_id)
    if not geojson_path or not geojson_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"GeoJSON dataset not found for network '{network_id}'.",
        )

    return FileResponse(
        path=str(geojson_path),
        media_type="application/geo+json",
        filename=f"{network_id}.geojson",
    )


@router.get("/cities/{city_id}/networks/{network_id}/edges", response_model=EdgeListResponse)
def list_network_edges(
    city_id: str,
    network_id: str,
    limit: int = Query(default=100, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    loader: NetworkLoader = Depends(get_network_loader),
) -> EdgeListResponse:
    """Lists edge identifiers and road properties in the network."""
    try:
        G, _ = loader.load_network(network_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to load network '{network_id}': {e}",
        )

    edges_list = []
    all_edges = list(G.edges(data=True))
    paged = all_edges[offset : offset + limit]

    for u, v, data in paged:
        edges_list.append(
            EdgeSummary(
                edge_id=data.get("edge_id", f"{u}_{v}_0"),
                name=data.get("name", "Unnamed Road"),
                highway=data.get("highway", "road"),
                length_m=data.get("length", 0.0),
                speed_kmh=data.get("speed_kmh", 40.0),
                lanes=data.get("lanes_count", 1),
                capacity_veh_hr=data.get("capacity_veh_hr", 1800.0),
                free_flow_time_s=data.get("free_flow_time_s", 0.0),
            )
        )

    return EdgeListResponse(edges=edges_list, total=len(all_edges))
