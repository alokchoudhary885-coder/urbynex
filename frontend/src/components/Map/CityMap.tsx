"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  Popup,
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

export type ColorMode = "highway" | "speed" | "capacity";

interface CityMapProps {
  networkId: string;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  colorMode?: ColorMode;
  selectedEdgeIds?: string[];
  onEdgeSelect?: (edge: SelectedEdge) => void;
  onEdgeDeselect?: (edgeId: string) => void;
  heightClass?: string;
}

// Public Dark Matter Basemap (no API key needed)
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

export function CityMap({
  networkId,
  initialCenter = [75.7873, 26.9124], // Jaipur [lng, lat]
  initialZoom = 13,
  colorMode = "highway",
  selectedEdgeIds = [],
  onEdgeSelect,
  onEdgeDeselect,
  heightClass = "h-[650px]",
}: CityMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featureCount, setFeatureCount] = useState<number>(0);
  const [hoveredEdge, setHoveredEdge] = useState<SelectedEdge | null>(null);

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
      case "speed":
        return [
          "step",
          ["coalesce", ["get", "speed_kmh"], 40],
          "#38bdf8", // < 30 km/h: sky blue
          30,
          "#34d399", // 30-50 km/h: emerald
          50,
          "#fbbf24", // 50-65 km/h: amber
          65,
          "#f87171", // >= 65 km/h: rose
        ];
      case "capacity":
        return [
          "step",
          ["coalesce", ["get", "capacity"], 1800],
          "#94a3b8", // <= 1800: slate
          1801,
          "#38bdf8", // 1801-3600: sky
          3601,
          "#818cf8", // 3601-5400: indigo
          5401,
          "#c084fc", // > 5400: purple
        ];
      case "highway":
      default:
        return [
          "match",
          ["get", "highway"],
          ["trunk", "trunk_link"],
          "#f59e0b", // Amber
          ["primary", "primary_link"],
          "#10b981", // Emerald
          ["secondary", "secondary_link"],
          "#06b6d4", // Cyan
          ["tertiary", "tertiary_link"],
          "#3b82f6", // Blue
          ["residential", "living_street"],
          "#64748b", // Slate
          "#94a3b8", // Default
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

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: CARTO_DARK_STYLE,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 25,
      bearing: 0,
      attributionControl: { compact: true },
    });

    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", async () => {
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

        if (!map.getSource("network-roads")) {
          map.addSource("network-roads", {
            type: "geojson",
            data: geojsonData,
          });

          // 1. Casing / Shadow Layer
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
                11,
                2,
                14,
                4,
                17,
                8,
              ],
              "line-opacity": 0.8,
            },
          });

          // 2. Main Glowing Road Layer
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
                11,
                1.2,
                14,
                2.6,
                17,
                5.5,
              ],
              "line-opacity": 0.9,
            },
          });

          // 3. Highlighted / Selected Edges Layer (Bright Coral/Red for interventions)
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
              "line-color": "#ef4444", // Bright red
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                3,
                14,
                6,
                17,
                10,
              ],
              "line-opacity": 1.0,
            },
          });

          // Fit bounds to network
          let bounds: [number, number, number, number] | null = null;
          if (geojsonData.bbox && geojsonData.bbox.length === 4) {
            bounds = geojsonData.bbox;
          } else if (geojsonData.features && geojsonData.features.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
            if (minX !== Infinity) {
              bounds = [minX, minY, maxX, maxY];
            }
          }

          if (bounds) {
            map.fitBounds(
              [
                [bounds[0], bounds[1]],
                [bounds[2], bounds[3]],
              ],
              { padding: 40, maxZoom: 15 }
            );
          }
        }

        // Hover effect
        map.on("mousemove", "network-roads-line", (e) => {
          if (!e.features || e.features.length === 0) return;
          map.getCanvas().style.cursor = "pointer";

          const feat = e.features[0];
          const props = feat.properties as Record<string, unknown>;
          const edge: SelectedEdge = {
            edge_id: String(props.edge_id || ""),
            name: String(props.name || "Unnamed Corridor"),
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

        // Click to inspect / select
        map.on("click", "network-roads-line", (e) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const props = feat.properties as Record<string, unknown>;
          const edgeId = String(props.edge_id || "");
          const edge: SelectedEdge = {
            edge_id: edgeId,
            name: String(props.name || "Unnamed Corridor"),
            highway: String(props.highway || "road"),
            length_m: Number(props.length_m || 0),
            speed_kmh: Number(props.speed_kmh || 40),
            lanes: Number(props.lanes || 1),
            capacity: Number(props.capacity || 1800),
          };

          // Toggle selection
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

          // Show popup
          if (popupRef.current) {
            popupRef.current.remove();
          }

          const isSelected = selectedEdgeIdsSet.current.has(edgeId);
          const popupHtml = `
            <div style="font-family: sans-serif; font-size: 12px; color: #0f172a; padding: 4px;">
              <div style="font-weight: 700; font-size: 13px; color: #0284c7; margin-bottom: 2px;">
                ${edge.name}
              </div>
              <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">
                Type: <b>${edge.highway}</b> · Edge ID: <code style="background:#f1f5f9; padding: 1px 3px; border-radius: 3px;">${edge.edge_id}</code>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px;">
                <div>Speed: <b>${edge.speed_kmh} km/h</b></div>
                <div>Lanes: <b>${edge.lanes}</b></div>
                <div>Capacity: <b>${edge.capacity} veh/h</b></div>
                <div>Length: <b>${edge.length_m.toFixed(1)} m</b></div>
              </div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 11px; color: ${isSelected ? '#dc2626' : '#16a34a'}; font-weight: 600;">
                ${isSelected ? '● Selected for Intervention' : '○ Click to select for road closure/incident'}
              </div>
            </div>
          `;

          const popup = new Popup({ closeButton: true, maxWidth: "300px" })
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
      if (popupRef.current) popupRef.current.remove();
      map.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId]);

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-gray-800 bg-gray-950 shadow-2xl`}>
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-300">Loading Road Network GeoJSON...</p>
          <span className="text-xs text-gray-500 font-mono">{networkId} · MapLibre GL Digital Twin</span>
        </div>
      )}

      {/* Error Banner */}
      {loadError && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-red-950/90 border border-red-700/80 text-red-200 text-xs px-4 py-3 rounded-lg backdrop-blur">
          <b>Map Data Warning:</b> {loadError}. Ensure FastAPI backend is running at http://localhost:8000.
        </div>
      )}

      {/* Top Left Stats Badge */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-gray-900/90 border border-gray-700/60 rounded-xl px-3.5 py-2.5 backdrop-blur-md shadow-lg flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <div className="text-xs font-semibold text-gray-100 flex items-center gap-1.5">
              <span>Jaipur Digital Twin</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                v1
              </span>
            </div>
            <div className="text-[11px] text-gray-400 font-mono">
              {featureCount > 0 ? `${featureCount.toLocaleString()} segments active` : "Synchronizing..."}
            </div>
          </div>
        </div>

        {/* Selected Interventions Pill */}
        {selectedEdgeIds.length > 0 && (
          <div className="bg-red-950/90 border border-red-700/70 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-lg flex items-center justify-between gap-3 text-xs text-red-200">
            <span>{selectedEdgeIds.length} road segment(s) targeted</span>
            <span className="text-[10px] font-mono uppercase bg-red-900/80 px-1.5 py-0.5 rounded text-red-300">
              Intervention
            </span>
          </div>
        )}
      </div>

      {/* Bottom Floating Hover Edge Inspector */}
      {hoveredEdge && (
        <div className="absolute bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-80 z-10 bg-gray-900/95 border border-gray-700/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs text-gray-200 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-emerald-400 truncate max-w-[200px]">
              {hoveredEdge.name}
            </span>
            <span className="px-1.5 py-0.5 bg-gray-800 text-[10px] uppercase rounded text-gray-400 font-mono">
              {hoveredEdge.highway}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-gray-400">
            <div>Speed: <span className="text-gray-200 font-medium">{hoveredEdge.speed_kmh} km/h</span></div>
            <div>Lanes: <span className="text-gray-200 font-medium">{hoveredEdge.lanes}</span></div>
            <div>Capacity: <span className="text-gray-200 font-medium">{hoveredEdge.capacity} veh/h</span></div>
            <div>Length: <span className="text-gray-200 font-medium">{hoveredEdge.length_m.toFixed(1)} m</span></div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-gray-800/80 text-[10px] text-gray-500 font-mono truncate">
            ID: {hoveredEdge.edge_id}
          </div>
        </div>
      )}
    </div>
  );
}
