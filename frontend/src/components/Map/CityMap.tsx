"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  Popup,
  Marker,
  type StyleSpecification,
  type ExpressionSpecification,
} from "maplibre-gl";

export interface SelectedEdge {
  edge_id: string;
  name: string;
  highway: string;
  length_m: number;
  speed_kmh: number;
  lanes: number;
  capacity: number;
}

export type ColorMode = "highway" | "speed" | "capacity" | "congestion";

interface CityMapProps {
  networkId: string;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  colorMode?: ColorMode;
  selectedEdgeIds?: string[];
  onEdgeSelect?: (edge: SelectedEdge) => void;
  onEdgeDeselect?: (edgeId: string) => void;
  heightClass?: string;
  show3DBuildings?: boolean;
}

// Public Dark Matter Basemap (raster base)
const CARTO_DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-dark-base",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

// Procedural 3D building generation around a centroid to deliver 3D digital twin buildings
function generate3DBuildings(lng: number, lat: number, count: number = 48) {
  const features = [];
  const spread = 0.018; // ~2km radius

  // Seeded deterministic pseudo-random for stability across renders
  let seed = Math.abs(Math.sin(lng * 100 + lat * 100) * 10000);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < count; i++) {
    const dLng = (rand() - 0.5) * spread * 2;
    const dLat = (rand() - 0.5) * spread * 1.5;
    const centerLng = lng + dLng;
    const centerLat = lat + dLat;

    // Building footprint dimensions
    const width = 0.0004 + rand() * 0.0006;
    const height = 0.0003 + rand() * 0.0005;

    // 3D Extrusion height in meters (skyscrapers near center, mid-rise around)
    const distFromCenter = Math.sqrt(dLng * dLng + dLat * dLat);
    const heightMultiplier = Math.max(0.2, 1 - distFromCenter / spread);
    const buildingHeight = Math.round(20 + rand() * 120 * heightMultiplier + (i % 7 === 0 ? 80 : 0));

    features.push({
      type: "Feature" as const,
      properties: {
        id: `bldg-${i}`,
        height: buildingHeight,
        base_height: 0,
        type: buildingHeight > 90 ? "tower" : "commercial",
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [centerLng - width / 2, centerLat - height / 2],
            [centerLng + width / 2, centerLat - height / 2],
            [centerLng + width / 2, centerLat + height / 2],
            [centerLng - width / 2, centerLat + height / 2],
            [centerLng - width / 2, centerLat - height / 2],
          ],
        ],
      },
    });
  }

  return {
    type: "FeatureCollection" as const,
    features,
  };
}

// City landmark callouts matching Dubai command center reference
interface Landmark {
  name: string;
  category: string;
  icon: string;
  coords: [number, number];
}

const CITY_LANDMARKS: Record<string, Landmark[]> = {
  jaipur_v1: [
    { name: "MI ROAD CORRIDOR", category: "Commercial Axis", icon: "🏛", coords: [75.801, 26.918] },
    { name: "AJMERI GATE", category: "Historic Transit", icon: "⛩", coords: [75.818, 26.916] },
    { name: "C-SCHEME TECH HUB", category: "Financial District", icon: "💼", coords: [75.795, 26.908] },
    { name: "CIVIL LINES", category: "Govt Quarter", icon: "🏢", coords: [75.782, 26.905] },
    { name: "PINK CITY CORE", category: "Heritage Zone", icon: "📍", coords: [75.824, 26.924] },
  ],
  delhi_v1: [
    { name: "CONNAUGHT PLACE (CP)", category: "Central Business District", icon: "⬡", coords: [77.219, 28.631] },
    { name: "BARAKHAMBA TOWERS", category: "Financial Hub", icon: "🏢", coords: [77.228, 28.629] },
    { name: "JANPATH CORRIDOR", category: "Retail & Transit", icon: "🛍", coords: [77.218, 28.622] },
    { name: "SHIVAJI METRO TERMINAL", category: "Airport Express", icon: "🚇", coords: [77.213, 28.633] },
    { name: "INDIA GATE AXIS", category: "Ceremonial Corridor", icon: "🏛", coords: [77.229, 28.613] },
  ],
  bengaluru_v1: [
    { name: "SILK BOARD INTERCHANGE", category: "Major Bottleneck Hub", icon: "⚠️", coords: [77.623, 12.917] },
    { name: "OUTER RING ROAD CORRIDOR", category: "Tech Arterial", icon: "🛣", coords: [77.635, 12.923] },
    { name: "HSR SECTOR 1", category: "Residential Hub", icon: "🏙", coords: [77.638, 12.912] },
    { name: "BELLANDUR ECOSPACE", category: "IT Park & SEZ", icon: "💻", coords: [77.632, 12.928] },
    { name: "ELECTRONIC CITY FLYOVER", category: "Express Corridor", icon: "🚗", coords: [77.619, 12.909] },
  ],
};

export function CityMap({
  networkId,
  initialCenter = [75.7873, 26.9124], // [lng, lat]
  initialZoom = 13.5,
  colorMode = "highway",
  selectedEdgeIds = [],
  onEdgeSelect,
  onEdgeDeselect,
  heightClass = "h-[650px]",
  show3DBuildings = true,
}: CityMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featureCount, setFeatureCount] = useState<number>(0);
  const [hoveredEdge, setHoveredEdge] = useState<SelectedEdge | null>(null);
  const [is3DMode, setIs3DMode] = useState<boolean>(true);

  const selectedEdgeIdsSet = useRef<Set<string>>(new Set(selectedEdgeIds));
  useEffect(() => {
    selectedEdgeIdsSet.current = new Set(selectedEdgeIds);
    if (mapRef.current && mapRef.current.getLayer("network-roads-selected")) {
      mapRef.current.setFilter("network-roads-selected", [
        "in",
        "edge_id",
        ...Array.from(selectedEdgeIdsSet.current),
      ]);
    }
  }, [selectedEdgeIds]);

  // Color expression by mode
  const getLineColorExpression = useCallback((mode: ColorMode): ExpressionSpecification => {
    switch (mode) {
      case "congestion":
        return [
          "step",
          ["coalesce", ["get", "speed_kmh"], 35],
          "#EF5350", // Congested (< 25 km/h): Red
          25,
          "#F5A623", // Moderate (25-45 km/h): Amber
          45,
          "#36C6A0", // Free flow (> 45 km/h): Teal
        ];
      case "speed":
        return [
          "step",
          ["coalesce", ["get", "speed_kmh"], 40],
          "#00B8D9", // < 30 km/h: cyan
          30,
          "#36C6A0", // 30-50 km/h: emerald
          50,
          "#F5A623", // 50-65 km/h: amber
          65,
          "#EF5350", // >= 65 km/h: red
        ];
      case "capacity":
        return [
          "step",
          ["coalesce", ["get", "capacity"], 1800],
          "#64748B", // <= 1800: slate
          1801,
          "#00B8D9", // 1801-3600: cyan
          3601,
          "#3B82F6", // 3601-5400: blue
          5401,
          "#8B5CF6", // > 5400: purple
        ];
      case "highway":
      default:
        return [
          "match",
          ["get", "highway"],
          ["trunk", "trunk_link", "motorway", "motorway_link"],
          "#F5A623", // Amber / Expressway
          ["primary", "primary_link"],
          "#00B8D9", // Cyan / Primary Arterial
          ["secondary", "secondary_link"],
          "#36C6A0", // Teal / Secondary
          ["tertiary", "tertiary_link"],
          "#3B82F6", // Blue / Tertiary
          ["residential", "living_street"],
          "#475569", // Slate / Residential
          "#64748B", // Default
        ];
    }
  }, []);

  // Update line color when mode changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("network-roads-line")) {
      map.setPaintProperty("network-roads-line", "line-color", getLineColorExpression(colorMode));
    }
  }, [colorMode, getLineColorExpression]);

  // Toggle 3D pitch/bearing
  const toggle3D = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (is3DMode) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      setIs3DMode(false);
    } else {
      map.easeTo({ pitch: 52, bearing: -15, duration: 1000 });
      setIs3DMode(true);
    }
  }, [is3DMode]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: CARTO_DARK_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 52, // Command Center oblique 3D perspective
      bearing: -15, // Angled city view like Dubai digital twin
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // ── 1. Fetch network GeoJSON from backend API ──────────────────────────
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/networks/${networkId}/geojson`);
        if (!res.ok) {
          throw new Error(`Failed to load network GeoJSON: HTTP ${res.status}`);
        }
        const geojsonData = await res.json();
        const count = geojsonData.features?.length || 0;
        setFeatureCount(count);

        // Compute centroid for 3D building generation
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (geojsonData.bbox && geojsonData.bbox.length === 4) {
          [minX, minY, maxX, maxY] = geojsonData.bbox;
        } else if (geojsonData.features && geojsonData.features.length > 0) {
          for (const f of geojsonData.features) {
            const coords = f.geometry?.coordinates;
            if (Array.isArray(coords)) {
              for (const pt of coords) {
                if (pt[0] < minX) minX = pt[0];
                if (pt[1] < minY) minY = pt[1];
                if (pt[0] > maxX) maxX = pt[0];
                if (pt[1] > maxY) maxY = pt[1];
              }
            }
          }
        }
        const centerLng = minX !== Infinity ? (minX + maxX) / 2 : initialCenter[0];
        const centerLat = minY !== Infinity ? (minY + maxY) / 2 : initialCenter[1];

        // ── 2. Add 3D Extruded Buildings Layer ─────────────────────────────────
        if (show3DBuildings && !map.getSource("urban-3d-buildings")) {
          const buildingsData = generate3DBuildings(centerLng, centerLat, 54);
          map.addSource("urban-3d-buildings", {
            type: "geojson",
            data: buildingsData,
          });

          map.addLayer({
            id: "urban-3d-buildings-extrusion",
            type: "fill-extrusion",
            source: "urban-3d-buildings",
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "height"],
                20, "#081827",
                50, "#0B1D2B",
                80, "#103247",
                120, "#164560",
                160, "#00B8D9",
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "base_height"],
              "fill-extrusion-opacity": 0.82,
            },
          });
        }

        // ── 3. Road Network Casing & Glow Layers ────────────────────────────────
        if (!map.getSource("network-roads")) {
          map.addSource("network-roads", {
            type: "geojson",
            data: geojsonData,
          });

          // Casing / Shadow Layer
          map.addLayer({
            id: "network-roads-casing",
            type: "line",
            source: "network-roads",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": "#030B14",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11, 2,
                14, 4.5,
                17, 9,
              ],
              "line-opacity": 0.9,
            },
          });

          // Ambient Glow Layer (creates command center neon highway effect)
          map.addLayer({
            id: "network-roads-glow",
            type: "line",
            source: "network-roads",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": getLineColorExpression(colorMode),
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11, 3,
                14, 6,
                17, 12,
              ],
              "line-opacity": 0.35,
              "line-blur": 2,
            },
          });

          // Main Sharp Road Layer
          map.addLayer({
            id: "network-roads-line",
            type: "line",
            source: "network-roads",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": getLineColorExpression(colorMode),
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11, 1.4,
                14, 2.8,
                17, 5.5,
              ],
              "line-opacity": 0.95,
            },
          });

          // Highlighted / Selected Edges Layer (Bright Coral/Red for interventions)
          map.addLayer({
            id: "network-roads-selected",
            type: "line",
            source: "network-roads",
            filter: [
              "in",
              "edge_id",
              ...Array.from(selectedEdgeIdsSet.current),
            ],
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": "#EF5350",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11, 3.5,
                14, 7,
                17, 12,
              ],
              "line-opacity": 1.0,
            },
          });

          // Fit bounds to network
          if (minX !== Infinity) {
            map.fitBounds(
              [
                [minX, minY],
                [maxX, maxY],
              ],
              { padding: 50, maxZoom: 15.5, pitch: 52, bearing: -15 }
            );
          }
        }

        // ── 4. Add Landmark Callout Markers ─────────────────────────────────────
        const landmarks = CITY_LANDMARKS[networkId] || CITY_LANDMARKS["jaipur_v1"] || [];
        landmarks.forEach((lm) => {
          const el = document.createElement("div");
          el.className = "cursor-pointer group select-none";
          el.innerHTML = `
            <div style="
              display: flex;
              align-items: center;
              gap: 4px;
              background: rgba(8, 24, 39, 0.92);
              border: 1px solid #1B3445;
              border-radius: 3px;
              padding: 2px 6px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.6);
              backdrop-filter: blur(4px);
              transition: all 0.2s ease;
            ">
              <span style="font-size: 10px;">${lm.icon}</span>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 8.5px; font-weight: 800; color: #EAF3F8; letter-spacing: 0.05em; white-space: nowrap;">${lm.name}</span>
                <span style="font-size: 7px; color: #00B8D9; font-weight: 600;">${lm.category}</span>
              </div>
            </div>
          `;

          const marker = new Marker({ element: el })
            .setLngLat(lm.coords)
            .addTo(map);

          markersRef.current.push(marker);
        });

        // ── 5. Hover and Click Interactions ─────────────────────────────────────
        map.on("mousemove", "network-roads-line", (e) => {
          if (!e.features || e.features.length === 0) return;
          map.getCanvas().style.cursor = "pointer";

          const feat = e.features[0];
          const props = feat.properties as Record<string, unknown>;
          const edge: SelectedEdge = {
            edge_id: String(props.edge_id || ""),
            name: String(props.name || "Urban Arterial"),
            highway: String(props.highway || "road"),
            length_m: Number(props.length_m || 0),
            speed_kmh: Number(props.speed_kmh || 40),
            lanes: Number(props.lanes || 1),
            capacity: Number(props.capacity || 1800),
          };
          setHoveredEdge(edge);
        });

        map.on("mouseleave", "network-roads-line", () => {
          map.getCanvas().style.cursor = "";
          setHoveredEdge(null);
        });

        map.on("click", "network-roads-line", (e) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const props = feat.properties as Record<string, unknown>;
          const edgeId = String(props.edge_id || "");
          const edge: SelectedEdge = {
            edge_id: edgeId,
            name: String(props.name || "Urban Arterial"),
            highway: String(props.highway || "road"),
            length_m: Number(props.length_m || 0),
            speed_kmh: Number(props.speed_kmh || 40),
            lanes: Number(props.lanes || 1),
            capacity: Number(props.capacity || 1800),
          };

          if (selectedEdgeIdsSet.current.has(edgeId)) {
            selectedEdgeIdsSet.current.delete(edgeId);
            onEdgeDeselect?.(edgeId);
          } else {
            selectedEdgeIdsSet.current.add(edgeId);
            onEdgeSelect?.(edge);
          }

          if (map.getLayer("network-roads-selected")) {
            map.setFilter("network-roads-selected", [
              "in",
              "edge_id",
              ...Array.from(selectedEdgeIdsSet.current),
            ]);
          }

          if (popupRef.current) popupRef.current.remove();

          const isSelected = selectedEdgeIdsSet.current.has(edgeId);
          const popupHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; color: #EAF3F8; padding: 2px;">
              <div style="font-weight: 700; font-size: 12px; color: #00B8D9; margin-bottom: 2px;">
                ${edge.name}
              </div>
              <div style="color: #8DA5B5; font-size: 10px; margin-bottom: 6px;">
                Class: <b style="color: #36C6A0">${edge.highway}</b> · Edge ID: <code style="background: rgba(0,184,217,0.1); padding: 1px 3px; border-radius: 2px;">${edge.edge_id}</code>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; font-size: 10px;">
                <div>Speed: <b>${edge.speed_kmh} km/h</b></div>
                <div>Lanes: <b>${edge.lanes}</b></div>
                <div>Capacity: <b>${edge.capacity} veh/h</b></div>
                <div>Length: <b>${edge.length_m.toFixed(1)} m</b></div>
              </div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #1B3445; font-size: 10px; color: ${isSelected ? '#EF5350' : '#36C6A0'}; font-weight: 600;">
                ${isSelected ? '● Targeted for Scenario Intervention' : '○ Click to toggle closure / incident'}
              </div>
            </div>
          `;

          const popup = new Popup({ closeButton: true, maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setHTML(popupHtml)
            .addTo(map);

          popupRef.current = popup;
        });

        setLoading(false);
      } catch (err: unknown) {
        console.error("Map load error:", err);
        setLoadError(err instanceof Error ? err.message : "Failed to load map data");
        setLoading(false);
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (popupRef.current) popupRef.current.remove();
      map.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId]);

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden`} style={{ background: "#06111C" }}>
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Loading Overlay */}
      {loading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-2"
          style={{ background: "rgba(6,17,28,0.85)", backdropFilter: "blur(6px)" }}
        >
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00B8D9", borderTopColor: "transparent" }} />
          <p className="text-xs font-semibold" style={{ color: "#EAF3F8" }}>Rendering 3D Digital Twin Network…</p>
          <span className="text-[10px] font-mono" style={{ color: "#8DA5B5" }}>{networkId} · MapLibre GL 3D Engine</span>
        </div>
      )}

      {/* Error Banner */}
      {loadError && (
        <div
          className="absolute top-3 left-3 right-3 z-30 px-3 py-2 rounded text-xs"
          style={{ background: "rgba(239,83,80,0.15)", border: "1px solid #EF5350", color: "#EF5350", backdropFilter: "blur(4px)" }}
        >
          <b>Network Warning:</b> {loadError}. Ensure FastAPI backend is running at http://localhost:8000.
        </div>
      )}

      {/* 2D / 3D Perspective Toggle Button */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
        <button
          onClick={toggle3D}
          className="px-2.5 py-1 rounded text-[10px] font-bold tracking-wide transition-all"
          style={{
            background: is3DMode ? "rgba(0,184,217,0.2)" : "rgba(8,24,39,0.85)",
            border: `1px solid ${is3DMode ? "#00B8D9" : "#1B3445"}`,
            color: is3DMode ? "#00B8D9" : "#8DA5B5",
            backdropFilter: "blur(4px)",
          }}
          title="Toggle 3D Oblique / 2D Orthographic Camera"
        >
          {is3DMode ? "🏙 3D VIEW" : "🗺 2D FLAT"}
        </button>

        {featureCount > 0 && (
          <span
            className="px-2 py-1 rounded text-[9px] font-mono"
            style={{ background: "rgba(8,24,39,0.85)", border: "1px solid #1B3445", color: "#8DA5B5", backdropFilter: "blur(4px)" }}
          >
            {featureCount.toLocaleString()} segments
          </span>
        )}
      </div>

      {/* Selected Interventions Pill */}
      {selectedEdgeIds.length > 0 && (
        <div
          className="absolute top-12 left-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded text-[10px]"
          style={{ background: "rgba(239,83,80,0.18)", border: "1px solid #EF5350", color: "#EF5350", backdropFilter: "blur(4px)" }}
        >
          <span>{selectedEdgeIds.length} segment(s) targeted for intervention</span>
        </div>
      )}

      {/* Hover Edge Inspector Pill */}
      {hoveredEdge && (
        <div
          className="absolute bottom-10 left-3 right-3 sm:left-auto sm:right-3 sm:w-72 z-20 rounded p-2.5 text-xs transition-all"
          style={{
            background: "rgba(11,29,43,0.95)",
            border: "1px solid #1B3445",
            color: "#EAF3F8",
            backdropFilter: "blur(6px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold truncate" style={{ color: "#00B8D9", maxWidth: "180px" }}>
              {hoveredEdge.name}
            </span>
            <span
              className="px-1.5 py-0.5 text-[8px] uppercase font-bold rounded"
              style={{ background: "rgba(54,198,160,0.15)", color: "#36C6A0" }}
            >
              {hoveredEdge.highway}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]" style={{ color: "#8DA5B5" }}>
            <div>Speed: <b style={{ color: "#EAF3F8" }}>{hoveredEdge.speed_kmh} km/h</b></div>
            <div>Lanes: <b style={{ color: "#EAF3F8" }}>{hoveredEdge.lanes}</b></div>
            <div>Capacity: <b style={{ color: "#EAF3F8" }}>{hoveredEdge.capacity} veh/h</b></div>
            <div>Length: <b style={{ color: "#EAF3F8" }}>{hoveredEdge.length_m.toFixed(1)} m</b></div>
          </div>
          <div className="mt-1 pt-1 text-[8px] font-mono truncate" style={{ borderTop: "1px solid #1B3445", color: "#8DA5B5" }}>
            Edge ID: {hoveredEdge.edge_id}
          </div>
        </div>
      )}
    </div>
  );
}
