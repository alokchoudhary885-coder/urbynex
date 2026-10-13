"""
backend/simulation/network_loader.py

Provides clean loading, validation, and querying of prepared road networks.
Loads GraphML network topologies and associated metadata.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import networkx as nx


class NetworkLoadError(Exception):
    """Raised when a road network cannot be found or fails integrity checks."""
    pass


class NetworkLoader:
    """Manages loading and querying validated road networks."""

    def __init__(self, networks_dir: Optional[Path] = None):
        if networks_dir is None:
            # Default to backend/data/networks relative to this file
            self.networks_dir = Path(__file__).resolve().parent.parent / "data" / "networks"
        else:
            self.networks_dir = Path(networks_dir)

    def list_available_networks(self) -> List[Dict[str, Any]]:
        """Scans the networks directory and returns summaries of available networks."""
        results = []
        if not self.networks_dir.exists():
            return results

        for net_folder in self.networks_dir.iterdir():
            if not net_folder.is_dir():
                continue
            meta_file = net_folder / "metadata.json"
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        results.append(meta)
                except Exception:
                    continue
        return results

    def load_network(self, network_id: str) -> tuple[nx.MultiDiGraph, Dict[str, Any]]:
        """
        Loads the GraphML graph and metadata for the specified network_id.
        Validates essential attributes required for traffic simulation.
        """
        net_dir = self.networks_dir / network_id
        if not net_dir.exists():
            raise NetworkLoadError(f"Network directory not found for ID: {network_id}")

        graphml_path = net_dir / "network.graphml"
        meta_path = net_dir / "metadata.json"

        if not graphml_path.exists():
            raise NetworkLoadError(f"GraphML file missing: {graphml_path}")
        if not meta_path.exists():
            raise NetworkLoadError(f"Metadata file missing: {meta_path}")

        # Load metadata
        with open(meta_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        # Load GraphML
        try:
            G = nx.read_graphml(graphml_path)
        except Exception as e:
            raise NetworkLoadError(f"Failed to parse GraphML for {network_id}: {e}")

        # Validate that essential attributes are present on edges
        missing_attrs = []
        if G.is_multigraph():
            edges_iter = list(G.edges(keys=True, data=True))
        else:
            edges_iter = [(u, v, 0, d) for u, v, d in G.edges(data=True)]

        for u, v, k, data in edges_iter:
            # GraphML stores numbers as strings if not typed; coerce numeric fields
            try:
                data["length"] = float(data.get("length", 10.0))
                data["speed_kmh"] = float(data.get("speed_kmh", 35.0))
                data["capacity_veh_hr"] = float(data.get("capacity_veh_hr", 1800.0))
                data["free_flow_time_s"] = float(data.get("free_flow_time_s", data["length"] / max(0.5, data["speed_kmh"] / 3.6)))
                data["lanes_count"] = int(float(data.get("lanes_count", 1)))
                if "edge_id" not in data or not data["edge_id"]:
                    data["edge_id"] = f"{u}_{v}_{k}"
            except (ValueError, TypeError) as conv_err:
                missing_attrs.append((u, v, str(conv_err)))
                if len(missing_attrs) > 5:
                    break

        if missing_attrs:
            raise NetworkLoadError(f"Network {network_id} has malformed edge attributes: {missing_attrs[:3]}")

        # Coerce node coordinates to floats
        for n, ndata in G.nodes(data=True):
            ndata["x"] = float(ndata.get("x", ndata.get("lon", 0.0)))
            ndata["y"] = float(ndata.get("y", ndata.get("lat", 0.0)))

        return G, metadata

    def get_network_geojson_path(self, network_id: str) -> Optional[Path]:
        """Returns the path to the network GeoJSON file if it exists."""
        geojson_path = self.networks_dir / network_id / "network.geojson"
        return geojson_path if geojson_path.exists() else None
