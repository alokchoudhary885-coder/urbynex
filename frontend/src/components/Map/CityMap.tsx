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
export type BasemapMode = "satellite" | "streets" | "dark";

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

// ── 1. High-Resolution Esri World Imagery (No API key needed, zero watermark) ──
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "satellite-tiles": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "&copy; Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "satellite-base",
      type: "raster",
      source: "satellite-tiles",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

// ── 2. OpenStreetMap Streets Style (No API key needed, zero watermark) ─────────
const STREETS_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "streets-base",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

// ── 3. Dark Night Digital Twin Style (Dark overlay over satellite) ─────────────
const DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "dark-tiles": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "&copy; Esri, Maxar",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "dark-satellite-base",
      type: "raster",
      source: "dark-tiles",
      minzoom: 0,
      maxzoom: 20,
      paint: {
        "raster-opacity": 0.85,
        "raster-brightness-max": 0.7,
        "raster-contrast": 0.2,
      },
    },
  ],
};

const BASEMAP_STYLES: Record<BasemapMode, StyleSpecification> = {
  satellite: SATELLITE_STYLE,
  streets: STREETS_STYLE,
  dark: DARK_STYLE,
};

// Procedural 3D building generation around city centroid
function generate3DBuildings(lng: number, lat: number, count: number = 72) {
  const features = [];
  const spread = 0.022; // ~2.5km radius

  let seed = Math.abs(Math.sin(lng * 100 + lat * 100) * 10000);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < count; i++) {
    const dLng = (rand() - 0.5) * spread * 2;
    const dLat = (rand() - 0.5) * spread * 1.6;
    const centerLng = lng + dLng;
    const centerLat = lat + dLat;

    // Building footprint dimensions
    const width = 0.00045 + rand() * 0.00075;
    const height = 0.00035 + rand() * 0.00065;

    // 3D Extrusion height in meters (skyscrapers near center, mid-rise around)
    const distFromCenter = Math.sqrt(dLng * dLng + dLat * dLat);
    const heightMultiplier = Math.max(0.25, 1 - distFromCenter / spread);
    const isIconicTower = i % 8 === 0;
    const buildingHeight = Math.round(
      25 + rand() * 110 * heightMultiplier + (isIconicTower ? 140 : 0)
    );

    features.push({
      type: "Feature" as const,
      properties: {
        id: `bldg-${i}`,
        height: buildingHeight,
        base_height: 0,
        type: buildingHeight > 120 ? "skyscraper" : buildingHeight > 60 ? "commercial" : "lowrise",
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
  initialCenter = [75.7873, 26.9124],
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

  const [basemapMode, setBasemapMode] = useState<BasemapMode>("satellite");
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
          "#FF1744", // Heavy congestion (< 25 km/h): Neon Crimson
          25,
          "#FFD600", // Moderate (25-45 km/h): Neon Amber
          45,
          "#00E676", // Free flow (> 45 km/h): Neon Green
        ];
      case "speed":
        return [
          "step",
          ["coalesce", ["get", "speed_kmh"], 40],
          "#00E5FF", // < 30 km/h: Cyan
          30,
          "#00E676", // 30-50 km/h: Emerald
          50,
          "#FFD600", // 50-65 km/h: Amber
          65,
          "#FF1744", // >= 65 km/h: Red
        ];
      case "capacity":
        return [
          "step",
          ["coalesce", ["get", "capacity"], 1800],
          "#90A4AE", // <= 1800: Slate
          1801,
          "#00E5FF", // 1801-3600: Cyan
          3601,
          "#2979FF", // 3601-5400: Blue
          5401,
          "#D500F9", // > 5400: Purple
        ];
      case "highway":
      default:
        return [
          "match",
          ["get", "highway"],
          ["trunk", "trunk_link", "motorway", "motorway_link"],
          "#FF9100", // Bright Orange / Expressway
          ["primary", "primary_link"],
          "#00E5FF", // Vibrant Neon Cyan / Primary Arterial
          ["secondary", "secondary_link"],
          "#00E676", // Emerald / Secondary
          ["tertiary", "tertiary_link"],
          "#2979FF", // Blue / Tertiary
          ["residential", "living_street"],
          "#78909C", // Slate / Residential
          "#90A4AE", // Default
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
    if (map.getLayer("network-roads-glow")) {
      map.setPaintProperty("network-roads-glow", "line-color", getLineColorExpression(colorMode));
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
      map.easeTo({ pitch: 54, bearing: -18, duration: 1000 });
      setIs3DMode(true);
    }
  }, [is3DMode]);

  // Switch basemap style
  const handleBasemapChange = (mode: BasemapMode) => {
    setBasemapMode(mode);
    if (!mapRef.current) return;
    mapRef.current.setStyle(BASEMAP_STYLES[mode]);
  };

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: BASEMAP_STYLES[basemapMode],
      center: initialCenter,
      zoom: initialZoom,
      pitch: 54, // Oblique 3D perspective matching Dubai Digital Twin
      bearing: -18,
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    const setupLayers = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // Fetch network GeoJSON from backend API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/networks/${networkId}/geojson`);
        if (!res.ok) {
          throw new Error(`Failed to load network GeoJSON: HTTP ${res.status}`);
        }
        const geojsonData = await res.json();
        const count = geojsonData.features?.length || 0;
        setFeatureCount(count);

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

        // ── 1. 3D Extruded Buildings Layer ────────────────────────────────────
        if (show3DBuildings && !map.getSource("urban-3d-buildings")) {
          const buildingsData = generate3DBuildings(centerLng, centerLat, 72);
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
                25, "#1B3A4B",
                60, "#006680",
                100, "#00B8D9",
                160, "#36C6A0",
                220, "#E0F7FA",
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "base_height"],
              "fill-extrusion-opacity": 0.88,
              "fill-extrusion-vertical-gradient": true,
            },
          });
        }

        // ── 2. Road Network Layers (Casing + Glow + Line) ──────────────────────
        if (!map.getSource("network-roads")) {
          map.addSource("network-roads", {
            type: "geojson",
            data: geojsonData,
          });

          // Casing Layer (dark shadow under roads)
          map.addLayer({
            id: "network-roads-casing",
            type: "line",
            source: "network-roads",
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": "#020617",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11, 2.5,
                14, 5.5,
                17, 11,
              ],
              "line-opacity": 0.95,
            },
          });

          // Glowing Corridor Layer (creates the iconic neon highway bloom)
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
                11, 4,
                14, 8,
                17, 16,
              ],
              "line-opacity": 0.55,
              "line-blur": 3,
            },
          });

          // Core Crisp Road Line
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
                11, 1.8,
                14, 3.5,
                17, 7,
              ],
              "line-opacity": 1.0,
            },
          });

          // Highlighted Interventions Layer
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
              "line-color": "#FF1744",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11, 4,
                14, 8,
                17, 14,
              ],
              "line-opacity": 1.0,
            },
          });

          // Fit bounds
          if (minX !== Infinity) {
            map.fitBounds(
              [
                [minX, minY],
                [maxX, maxY],
              ],
              { padding: 50, maxZoom: 15.5, pitch: 54, bearing: -18 }
            );
          }
        }

        // ── 3. Landmark Callout Pins ───────────────────────────────────────────
        const landmarks = CITY_LANDMARKS[networkId] || CITY_LANDMARKS["jaipur_v1"] || [];
        landmarks.forEach((lm) => {
          const el = document.createElement("div");
          el.className = "cursor-pointer group select-none";
          el.innerHTML = `
            <div style="
              display: flex;
              align-items: center;
              gap: 5px;
              background: rgba(6, 17, 28, 0.94);
              border: 1px solid #00B8D9;
              border-radius: 4px;
              padding: 3px 7px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.8), 0 0 10px rgba(0,184,217,0.3);
              backdrop-filter: blur(6px);
              transition: transform 0.15s ease;
            ">
              <span style="font-size: 11px;">${lm.icon}</span>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 8.5px; font-weight: 800; color: #EAF3F8; letter-spacing: 0.05em; white-space: nowrap;">${lm.name}</span>
                <span style="font-size: 7px; color: #36C6A0; font-weight: 600;">${lm.category}</span>
              </div>
            </div>
          `;

          const marker = new Marker({ element: el })
            .setLngLat(lm.coords)
            .addTo(map);

          markersRef.current.push(marker);
        });

        // ── 4. Edge Interaction Listeners ──────────────────────────────────────
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
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #1B3445; font-size: 10px; color: ${isSelected ? '#FF1744' : '#36C6A0'}; font-weight: 600;">
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
    };

    map.on("load", setupLayers);
    // When style changes, re-setup layers
    map.on("style.load", () => {
      if (map.isStyleLoaded()) {
        setupLayers();
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (popupRef.current) popupRef.current.remove();
      map.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId, basemapMode]);

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
          <span className="text-[10px] font-mono" style={{ color: "#8DA5B5" }}>{networkId} · Satellite 3D Engine</span>
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

      {/* ── Basemap Style Switcher & 3D Controls ───────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
        {/* Basemap switcher */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded"
          style={{ background: "rgba(6,17,28,0.92)", border: "1px solid #1B3445", backdropFilter: "blur(6px)" }}
        >
          {(
            [
              { id: "satellite", label: "🛰 Satellite" },
              { id: "streets",   label: "🏙 Streets"   },
              { id: "dark",      label: "🌑 Night"     },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              onClick={() => handleBasemapChange(b.id)}
              className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
              style={{
                background: basemapMode === b.id ? "rgba(0,184,217,0.25)" : "transparent",
                color: basemapMode === b.id ? "#00B8D9" : "#8DA5B5",
                border: basemapMode === b.id ? "1px solid rgba(0,184,217,0.5)" : "1px solid transparent",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* 2D / 3D Perspective Toggle Button */}
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
          style={{ background: "rgba(255,23,68,0.2)", border: "1px solid #FF1744", color: "#FF1744", backdropFilter: "blur(4px)" }}
        >
          <span>{selectedEdgeIds.length} segment(s) targeted for intervention</span>
        </div>
      )}

      {/* Hover Edge Inspector Pill */}
      {hoveredEdge && (
        <div
          className="absolute bottom-12 left-3 right-3 sm:left-auto sm:right-3 sm:w-72 z-20 rounded p-2.5 text-xs transition-all"
          style={{
            background: "rgba(11,29,43,0.95)",
            border: "1px solid #00B8D9",
            color: "#EAF3F8",
            backdropFilter: "blur(6px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold truncate" style={{ color: "#00B8D9", maxWidth: "180px" }}>
              {hoveredEdge.name}
            </span>
            <span
              className="px-1.5 py-0.5 text-[8px] uppercase font-bold rounded"
              style={{ background: "rgba(54,198,160,0.2)", color: "#36C6A0" }}
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
