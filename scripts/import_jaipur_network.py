"""
scripts/import_jaipur_network.py

M1.1 — S6 + S7: Fetch, enrich, and validate Jaipur road network from OpenStreetMap.

Area: MI Road to JLN Marg corridor, Jaipur
Bounding Box:
    South (min_lat): 26.912
    West (min_lon):  75.818
    North (max_lat): 26.930
    East (max_lon):  75.836

Method:
    1. Fetches official OpenStreetMap XML via the primary OSM API 0.6:
       https://api.openstreetmap.org/api/0.6/map?bbox=min_lon,min_lat,max_lon,max_lat
    2. Parses XML nodes, road ways, and attributes (highway, lanes, maxspeed, oneway).
    3. Calculates accurate geodesic segment lengths (Haversine formula in meters).
    4. Constructs a NetworkX MultiDiGraph respecting one-way directionality.
    5. Retains the largest strongly connected component for valid continuous routing.
    6. Enriches attributes with speeds, lane counts, derived capacities, and free-flow times.
    7. Validates network integrity and connectivity.
    8. Exports GraphML, GeoJSON (for web map), metadata.json, and validation_report.json.
"""

import json
import math
import sys
import os
import hashlib
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
import requests
import networkx as nx

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "backend" / "data" / "networks" / "jaipur_v1"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

NETWORK_GRAPHML = OUTPUT_DIR / "network.graphml"
NETWORK_GEOJSON = OUTPUT_DIR / "network.geojson"
METADATA_FILE = OUTPUT_DIR / "metadata.json"
VALIDATION_FILE = OUTPUT_DIR / "validation_report.json"

USER_AGENT = "Urbynex/1.0 (https://github.com/alokchoudhary885-coder/urbynex; alokchoudhary885@gmail.com)"

BBOX = {
    "south": 26.912,
    "west": 75.818,
    "north": 26.930,
    "east": 75.836,
}

DRIVE_HIGHWAY_TYPES = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
}


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two points on Earth in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * R * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def fetch_osm_xml(bbox: dict) -> bytes:
    """Fetches raw OSM XML from the official OpenStreetMap API."""
    w, s, e, n = bbox["west"], bbox["south"], bbox["east"], bbox["north"]
    url = f"https://api.openstreetmap.org/api/0.6/map?bbox={w},{s},{e},{n}"
    headers = {"User-Agent": USER_AGENT}

    log(f"Fetching road network from official OSM API...")
    log(f"  URL: {url}")
    t0 = time.time()
    resp = requests.get(url, headers=headers, timeout=45)
    elapsed = time.time() - t0

    if resp.status_code != 200:
        raise RuntimeError(f"OSM API request failed with status {resp.status_code}: {resp.text[:200]}")

    log(f"  Received {len(resp.content)} bytes in {elapsed:.2f}s")
    return resp.content


def parse_osm_into_graph(xml_bytes: bytes, bbox: dict) -> nx.MultiDiGraph:
    """Parses OSM XML into a directed NetworkX MultiDiGraph."""
    log("Parsing OSM XML elements...")
    root = ET.fromstring(xml_bytes)

    # 1. Parse nodes
    nodes_dict = {}
    for node_el in root.findall("node"):
        nid = int(node_el.attrib["id"])
        lat = float(node_el.attrib["lat"])
        lon = float(node_el.attrib["lon"])
        nodes_dict[nid] = (lat, lon)

    log(f"  Parsed {len(nodes_dict)} OSM nodes.")

    G = nx.MultiDiGraph(
        name="Jaipur MI Road - JLN Marg Corridor",
        city="Jaipur",
        country="India",
        crs="EPSG:4326",
    )

    # 2. Parse ways and build directed edges
    drive_way_count = 0
    added_edges = 0

    for way_el in root.findall("way"):
        way_id = int(way_el.attrib["id"])
        tags = {t.attrib["k"]: t.attrib["v"] for t in way_el.findall("tag")}
        hw = tags.get("highway")

        if hw not in DRIVE_HIGHWAY_TYPES:
            continue

        drive_way_count += 1
        name = tags.get("name", "Unnamed Road")
        oneway_val = tags.get("oneway", "no")
        is_oneway = oneway_val in ("yes", "true", "1")
        is_reverse = oneway_val == "-1"

        raw_lanes = tags.get("lanes", "")
        raw_maxspeed = tags.get("maxspeed", "")

        node_refs = [int(nd.attrib["ref"]) for nd in way_el.findall("nd")]

        for i in range(len(node_refs) - 1):
            u = node_refs[i]
            v = node_refs[i + 1]

            if u not in nodes_dict or v not in nodes_dict:
                continue

            u_lat, u_lon = nodes_dict[u]
            v_lat, v_lon = nodes_dict[v]

            if not G.has_node(u):
                G.add_node(u, y=u_lat, x=u_lon, lat=u_lat, lon=u_lon)
            if not G.has_node(v):
                G.add_node(v, y=v_lat, x=v_lon, lat=v_lat, lon=v_lon)

            dist_m = max(1.0, round(haversine_distance(u_lat, u_lon, v_lat, v_lon), 2))

            edge_data = {
                "osmid": way_id,
                "highway": hw,
                "name": name,
                "length": dist_m,
                "raw_lanes": str(raw_lanes),
                "raw_maxspeed": str(raw_maxspeed),
            }

            if is_reverse:
                G.add_edge(v, u, **edge_data)
                added_edges += 1
            elif is_oneway:
                G.add_edge(u, v, **edge_data)
                added_edges += 1
            else:
                G.add_edge(u, v, **edge_data)
                G.add_edge(v, u, **edge_data)
                added_edges += 2

    log(f"  Processed {drive_way_count} drivable ways -> {len(G.nodes)} nodes, {added_edges} directed edges.")

    # Retain the largest strongly connected component
    if len(G.nodes) > 0:
        scc_components = list(nx.strongly_connected_components(G))
        largest_scc = max(scc_components, key=len)
        scc_pct = round(100.0 * len(largest_scc) / len(G.nodes), 1)
        G = G.subgraph(largest_scc).copy()
        log(f"  Retained largest SCC ({scc_pct}% of drivable network): {len(G.nodes)} nodes, {len(G.edges)} directed edges.")

    return G


def enrich_network_attributes(G: nx.MultiDiGraph) -> tuple[nx.MultiDiGraph, dict]:
    """Enriches edges with verified speeds, lane counts, capacity, and travel times."""
    DEFAULT_SPEED_MAP = {
        "motorway": 60.0,
        "motorway_link": 40.0,
        "trunk": 50.0,
        "trunk_link": 35.0,
        "primary": 50.0,
        "primary_link": 35.0,
        "secondary": 40.0,
        "secondary_link": 30.0,
        "tertiary": 35.0,
        "tertiary_link": 25.0,
        "residential": 30.0,
        "unclassified": 30.0,
        "living_street": 20.0,
    }
    DEFAULT_SPEED_KMH = 35.0
    CAPACITY_PER_LANE = 1800  # veh/hr/lane

    speed_assumed = 0
    lanes_assumed = 0
    total_edges = len(G.edges)

    for u, v, k, data in G.edges(keys=True, data=True):
        # 1. Speed limit
        raw_spd = data.get("raw_maxspeed", "")
        if raw_spd:
            try:
                data["speed_kmh"] = float(raw_spd.split()[0])
                data["speed_source"] = "osm"
            except (ValueError, IndexError):
                hw = data.get("highway", "")
                data["speed_kmh"] = DEFAULT_SPEED_MAP.get(hw, DEFAULT_SPEED_KMH)
                data["speed_source"] = "assumed_road_class_default"
                speed_assumed += 1
        else:
            hw = data.get("highway", "")
            data["speed_kmh"] = DEFAULT_SPEED_MAP.get(hw, DEFAULT_SPEED_KMH)
            data["speed_source"] = "assumed_road_class_default"
            speed_assumed += 1

        # 2. Lanes
        raw_ln = data.get("raw_lanes", "")
        if raw_ln:
            try:
                data["lanes_count"] = max(1, int(raw_ln.split()[0]))
                data["lanes_source"] = "osm"
            except (ValueError, IndexError):
                hw = data.get("highway", "")
                data["lanes_count"] = 2 if hw in ("motorway", "trunk", "primary") else 1
                data["lanes_source"] = "assumed_default"
                lanes_assumed += 1
        else:
            hw = data.get("highway", "")
            data["lanes_count"] = 2 if hw in ("motorway", "trunk", "primary") else 1
            data["lanes_source"] = "assumed_arterial_default" if hw in ("motorway", "trunk", "primary") else "assumed_default"
            lanes_assumed += 1

        # 3. Capacity & Free-Flow Travel Time
        data["capacity_veh_hr"] = data["lanes_count"] * CAPACITY_PER_LANE
        data["capacity_source"] = "derived_lanes_x_1800"

        length_m = data.get("length", 10.0)
        speed_ms = max(1.0, data["speed_kmh"] / 3.6)
        data["free_flow_time_s"] = round(length_m / speed_ms, 2)
        data["edge_id"] = f"{u}_{v}_{k}"

    assumptions = {
        "total_edges": total_edges,
        "speed_assumed_count": speed_assumed,
        "speed_assumed_pct": round(100.0 * speed_assumed / max(1, total_edges), 1),
        "lanes_assumed_count": lanes_assumed,
        "lanes_assumed_pct": round(100.0 * lanes_assumed / max(1, total_edges), 1),
        "capacity_model": "lanes * 1800 veh/hr/lane",
        "default_speeds": DEFAULT_SPEED_MAP,
        "note": "Documented urban Indian road class speeds applied where maxspeed tag is absent.",
    }
    return G, assumptions


def validate_network(G: nx.MultiDiGraph) -> dict:
    """Validates network topology and returns detailed integrity metrics."""
    node_count = len(G.nodes)
    edge_count = len(G.edges)
    issues = []
    warnings = []

    if node_count < 20:
        issues.append(f"Network node count too low ({node_count})")
    if edge_count < 20:
        issues.append(f"Network edge count too low ({edge_count})")

    # Connectivity
    is_scc = nx.is_strongly_connected(G)
    scc_pct = 100.0 if is_scc else round(100.0 * len(max(nx.strongly_connected_components(G), key=len)) / max(1, node_count), 1)

    total_length_km = round(sum(d.get("length", 0) for _, _, _, d in G.edges(keys=True, data=True)) / 1000.0, 2)

    status = "passed" if not issues else "failed"
    if status == "passed" and warnings:
        status = "passed_with_warnings"

    report = {
        "status": status,
        "node_count": node_count,
        "edge_count": edge_count,
        "total_road_length_km": total_length_km,
        "is_strongly_connected": is_scc,
        "scc_coverage_pct": scc_pct,
        "issues": issues,
        "warnings": warnings,
        "validated_at": datetime.now(timezone.utc).isoformat(),
    }
    return report


def export_geojson(G: nx.MultiDiGraph, out_path: Path) -> None:
    """Exports road network segments to GeoJSON for web map visualization."""
    features = []
    for u, v, k, data in G.edges(keys=True, data=True):
        u_node = G.nodes[u]
        v_node = G.nodes[v]
        coords = [
            [u_node["x"], u_node["y"]],
            [v_node["x"], v_node["y"]],
        ]
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
            "properties": {
                "edge_id": data.get("edge_id", f"{u}_{v}_{k}"),
                "name": data.get("name", "Unnamed Road"),
                "highway": data.get("highway", "road"),
                "length_m": data.get("length", 0),
                "speed_kmh": data.get("speed_kmh", 35),
                "lanes": data.get("lanes_count", 1),
                "capacity": data.get("capacity_veh_hr", 1800),
                "free_flow_time_s": data.get("free_flow_time_s", 0),
            },
        }
        features.append(feature)

    geojson_obj = {
        "type": "FeatureCollection",
        "features": features,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson_obj, f, indent=2)


def save_artifacts(G: nx.MultiDiGraph, bbox: dict, validation: dict, assumptions: dict) -> dict:
    """Saves GraphML, GeoJSON, metadata.json, and validation_report.json."""
    log(f"Saving network artifacts to {OUTPUT_DIR}...")

    # GraphML
    nx.write_graphml(G, NETWORK_GRAPHML)
    file_size_kb = NETWORK_GRAPHML.stat().st_size // 1024

    with open(NETWORK_GRAPHML, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()[:16]

    # GeoJSON
    export_geojson(G, NETWORK_GEOJSON)
    geojson_size_kb = NETWORK_GEOJSON.stat().st_size // 1024

    metadata = {
        "network_id": "jaipur_v1",
        "city_id": "jaipur",
        "city_name": "Jaipur",
        "corridor": "MI Road to JLN Marg Corridor",
        "version": "v1",
        "source": "OpenStreetMap contributors",
        "license": "Open Database License (ODbL) 1.0",
        "attribution": "© OpenStreetMap contributors",
        "bbox": bbox,
        "node_count": validation["node_count"],
        "edge_count": validation["edge_count"],
        "total_road_length_km": validation["total_road_length_km"],
        "is_strongly_connected": validation["is_strongly_connected"],
        "scc_coverage_pct": validation["scc_coverage_pct"],
        "validation_status": validation["status"],
        "sha256_hash": file_hash,
        "files": {
            "graphml": NETWORK_GRAPHML.name,
            "graphml_size_kb": file_size_kb,
            "geojson": NETWORK_GEOJSON.name,
            "geojson_size_kb": geojson_size_kb,
        },
        "assumptions": assumptions,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "simulation_ready": validation["status"] in ("passed", "passed_with_warnings"),
    }

    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    with open(VALIDATION_FILE, "w", encoding="utf-8") as f:
        json.dump(validation, f, indent=2)

    log(f"  Artifacts written: GraphML ({file_size_kb} KB), GeoJSON ({geojson_size_kb} KB), metadata.json")
    return metadata


def main() -> int:
    log("=== URBYNEX JAIPUR ROAD NETWORK IMPORT ===")
    t_start = time.time()

    try:
        xml_bytes = fetch_osm_xml(BBOX)
        G = parse_osm_into_graph(xml_bytes, BBOX)
        G, assumptions = enrich_network_attributes(G)
        validation = validate_network(G)
        metadata = save_artifacts(G, BBOX, validation, assumptions)

        elapsed = time.time() - t_start
        log("=== IMPORT SUMMARY ===")
        log(f"  City: {metadata['city_name']} ({metadata['corridor']})")
        log(f"  Nodes: {metadata['node_count']}")
        log(f"  Directed Edges: {metadata['edge_count']}")
        log(f"  Total Length: {metadata['total_road_length_km']} km")
        log(f"  SCC Connected: {metadata['is_strongly_connected']} (100% reachable)")
        log(f"  Validation Status: {metadata['validation_status'].upper()}")
        log(f"  Simulation Ready: {metadata['simulation_ready']}")
        log(f"  Execution Time: {elapsed:.2f}s")
        log("======================")
        return 0 if metadata["simulation_ready"] else 1

    except Exception as e:
        log(f"FATAL ERROR during network import: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
