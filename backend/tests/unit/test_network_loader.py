"""
backend/tests/unit/test_network_loader.py

Unit tests for NetworkLoader and Jaipur v1 road network dataset.
"""

import pytest
import networkx as nx
from pathlib import Path
from backend.simulation.network_loader import NetworkLoader, NetworkLoadError


@pytest.fixture
def loader():
    return NetworkLoader()


def test_list_available_networks(loader):
    networks = loader.list_available_networks()
    assert len(networks) >= 1
    net_ids = [n.get("network_id") for n in networks]
    assert "jaipur_v1" in net_ids

    jaipur = next(n for n in networks if n.get("network_id") == "jaipur_v1")
    assert jaipur["city_id"] == "jaipur"
    assert jaipur["simulation_ready"] is True
    assert jaipur["node_count"] > 1000
    assert jaipur["edge_count"] > 2000


def test_load_jaipur_network_success(loader):
    G, metadata = loader.load_network("jaipur_v1")
    assert isinstance(G, (nx.DiGraph, nx.MultiDiGraph))
    assert G.is_directed()
    assert len(G.nodes) == metadata["node_count"]
    assert len(G.edges) == metadata["edge_count"]

    # Verify nodes have valid coordinates
    sample_node = next(iter(G.nodes))
    ndata = G.nodes[sample_node]
    assert "x" in ndata and "y" in ndata
    assert 75.80 <= ndata["x"] <= 75.85
    assert 26.90 <= ndata["y"] <= 26.95

    # Verify edge numeric attributes
    if G.is_multigraph():
        u, v, k, edata = next(iter(G.edges(keys=True, data=True)))
    else:
        u, v, edata = next(iter(G.edges(data=True)))
    assert isinstance(edata["length"], float)
    assert edata["length"] > 0
    assert isinstance(edata["speed_kmh"], float)
    assert edata["speed_kmh"] > 0
    assert isinstance(edata["capacity_veh_hr"], float)
    assert edata["capacity_veh_hr"] >= 1800
    assert isinstance(edata["free_flow_time_s"], float)
    assert edata["free_flow_time_s"] > 0


def test_shortest_path_routing(loader):
    """Verifies that Dijkstra shortest path routing succeeds on the loaded network."""
    G, _ = loader.load_network("jaipur_v1")
    nodes = list(G.nodes)
    assert len(nodes) > 10

    # Test path between two distinct reachable nodes
    source = nodes[0]
    target = nodes[50]

    # Use free_flow_time_s as edge weight
    path = nx.shortest_path(G, source=source, target=target, weight="free_flow_time_s")
    assert len(path) >= 2
    assert path[0] == source
    assert path[-1] == target

    # Path length computation
    length = nx.shortest_path_length(G, source=source, target=target, weight="free_flow_time_s")
    assert length > 0


def test_load_nonexistent_network_raises_error(loader):
    with pytest.raises(NetworkLoadError):
        loader.load_network("non_existent_city_xyz")


def test_geojson_file_accessible(loader):
    geojson_path = loader.get_network_geojson_path("jaipur_v1")
    assert geojson_path is not None
    assert geojson_path.exists()
    assert geojson_path.stat().st_size > 1000
