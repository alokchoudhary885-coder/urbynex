"""
scripts/import_delhi_network.py

Phase 4 (M4.1): Fetch, enrich, validate and export the Delhi Connaught Place road network.
Corridor: Connaught Place - Barakhamba - Janpath Corridor, New Delhi.
Bounding Box:
    South (min_lat): 28.6210
    West (min_lon):  77.2060
    North (max_lat): 28.6410
    East (max_lon):  77.2280
"""

import hashlib
import json
import math
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import networkx as nx
import requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "backend" / "data" / "networks" / "delhi_v1"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

NETWORK_GRAPHML = OUTPUT_DIR / "network.graphml"
NETWORK_GEOJSON = OUTPUT_DIR / "network.geojson"
METADATA_FILE = OUTPUT_DIR / "metadata.json"
VALIDATION_FILE = OUTPUT_DIR / "validation_report.json"

USER_AGENT = "Urbynex/1.0 (https://github.com/alokchoudhary885-coder/urbynex; alokchoudhary885@gmail.com)"

BBOX = {
    "south": 28.6210,
    "west": 77.2060,
    "north": 28.6410,
    "east": 77.2280,
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
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * R * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def fetch_osm_xml(bbox: dict) -> bytes:
    w, s, e, n = bbox["west"], bbox["south"], bbox["east"], bbox["north"]
    headers = {"User-Agent": USER_AGENT}

    # Primary: OSM API 0.6
    url_primary = f"https://api.openstreetmap.org/api/0.6/map?bbox={w},{s},{e},{n}"
    log(f"Fetching Delhi Connaught Place network from OSM API...")
    log(f"  URL: {url_primary}")

    try:
        t0 = time.time()
        resp = requests.get(url_primary, headers=headers, timeout=45)
        if resp.status_code == 200 and len(resp.content) > 1000:
            log(f"  Success: received {len(resp.content):,} bytes in {time.time() - t0:.2f}s")
            return resp.content
        log(f"  Primary OSM API returned {resp.status_code}, falling back to Overpass API...")
    except Exception as exc:
        log(f"  Primary OSM request error: {exc}, trying Overpass fallback...")

    # Secondary: Overpass API
    overpass_url = "https://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:xml][timeout:60];
    (
      way["highway"]({s},{w},{n},{e});
      >;
    );
    out body;
    """
    log(f"  Querying Overpass API...")
    t0 = time.time()
    resp2 = requests.post(overpass_url, data={"data": overpass_query}, headers=headers, timeout=60)
    if resp2.status_code != 200:
        raise RuntimeError(f"Overpass API also failed with status {resp2.status_code}: {resp2.text[:200]}")

    log(f"  Success: Overpass returned {len(resp2.content):,} bytes in {time.time() - t0:.2f}s")
    return resp2.content


def parse_osm_into_graph(xml_bytes: bytes) -> nx.MultiDiGraph:
    log("Parsing OSM XML elements...")
    root = ET.fromstring(xml_bytes)

    nodes_dict = {}
    for node_el in root.findall("node"):
        nid = int(node_el.attrib["id"])
        lat = float(node_el.attrib["lat"])
        lon = float(node_el.attrib["lon"])
        nodes_dict[nid] = (lat, lon)

    log(f"  Parsed {len(nodes_dict)} OSM nodes.")

    G = nx.MultiDiGraph(
        name="Delhi Connaught Place - Barakhamba Corridor",
        city="Delhi",
        country="India",
        crs="EPSG:4326",
    )

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
    node_count = len(G.nodes)
    edge_count = len(G.edges)
    issues = []
    warnings = []

    if node_count < 20:
        issues.append(f"Network node count too low ({node_count})")
    if edge_count < 20:
        issues.append(f"Network edge count too low ({edge_count})")

    is_scc = nx.is_strongly_connected(G)
    scc_pct = 100.0 if is_scc else round(100.0 * len(max(nx.strongly_connected_components(G), key=len)) / max(1, node_count), 1)
    total_length_km = round(sum(d.get("length", 0) for _, _, _, d in G.edges(keys=True, data=True)) / 1000.0, 2)

    status = "passed" if not issues else "failed"

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
    log(f"  Exported GeoJSON ({len(features)} features) -> {out_path}")


def main():
    log("=== Urbynex: Delhi Connaught Place Road Network Importer (M4.1) ===")
    xml_bytes = fetch_osm_xml(BBOX)
    G = parse_osm_into_graph(xml_bytes)
    G, assumptions = enrich_network_attributes(G)
    val_report = validate_network(G)
    log(f"Validation status: {val_report['status']} ({val_report['node_count']} nodes, {val_report['edge_count']} edges, {val_report['total_road_length_km']} km)")

    # 1. Export GraphML
    nx.write_graphml(G, NETWORK_GRAPHML)
    log(f"  Exported GraphML -> {NETWORK_GRAPHML}")

    # 2. Export GeoJSON
    export_geojson(G, NETWORK_GEOJSON)

    # 3. Export validation report
    with open(VALIDATION_FILE, "w", encoding="utf-8") as f:
        json.dump(val_report, f, indent=2)

    # 4. Compute SHA256 of GraphML
    hasher = hashlib.sha256()
    with open(NETWORK_GRAPHML, "rb") as f:
        hasher.update(f.read())
    sha = hasher.hexdigest()[:16]

    # 5. Metadata JSON
    metadata = {
        "network_id": "delhi_v1",
        "city_id": "delhi",
        "city_name": "Delhi",
        "corridor": "Connaught Place - Barakhamba Corridor",
        "version": "v1",
        "source": "OpenStreetMap contributors",
        "license": "Open Database License (ODbL) 1.0",
        "attribution": "© OpenStreetMap contributors",
        "bbox": BBOX,
        "node_count": val_report["node_count"],
        "edge_count": val_report["edge_count"],
        "total_road_length_km": val_report["total_road_length_km"],
        "is_strongly_connected": val_report["is_strongly_connected"],
        "scc_coverage_pct": val_report["scc_coverage_pct"],
        "validation_status": val_report["status"],
        "sha256_hash": sha,
        "files": {
            "graphml": "network.graphml",
            "graphml_size_kb": int(NETWORK_GRAPHML.stat().st_size / 1024),
            "geojson": "network.geojson",
            "geojson_size_kb": int(NETWORK_GEOJSON.stat().st_size / 1024),
        },
        "assumptions": assumptions,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "simulation_ready": True,
    }

    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    log(f"  Exported metadata -> {METADATA_FILE}")
    log("=== Delhi Network Ingestion Complete! ===")


if __name__ == "__main__":
    main()
