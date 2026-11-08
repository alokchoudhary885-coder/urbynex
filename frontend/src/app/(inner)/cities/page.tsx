"use client";

/**
 * frontend/src/app/(inner)/cities/page.tsx
 *
 * Command Center City Digital Twin Explorer
 * - Multi-city interactive 3D geospatial network exploration
 * - High-density telemetry cards for nodes, edges, road length and validation status
 * - Segment inspection and intervention routing
 */

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCities, useCityNetworks } from "@/lib/hooks/useApi";
import type { ColorMode, SelectedEdge } from "@/components/Map/CityMap";
import { NetworkLayerControls } from "@/components/Map/NetworkLayerControls";

const CityMap = dynamic(
  () => import("@/components/Map/CityMap").then((m) => m.CityMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[750px] w-full flex flex-col items-center justify-center gap-3 rounded-lg"
        style={{ background: "#0B1D2B", border: "1px solid #1B3445", color: "#8DA5B5" }}
      >
        <div
          className="w-7 h-7 border-2 rounded-full animate-spin"
          style={{ borderColor: "#00B8D9", borderTopColor: "transparent" }}
        />
        <span className="text-xs font-mono">Loading 3D Geospatial Engine...</span>
      </div>
    ),
  }
);

export default function CitiesPage() {
  const { data: citiesData, loading: citiesLoading, error: citiesError } = useCities();
  const [selectedCityId, setSelectedCityId] = useState<string>("jaipur");
  const { data: networksData } = useCityNetworks(selectedCityId);

  const [colorMode, setColorMode] = useState<ColorMode>("highway");
  const [selectedEdges, setSelectedEdges] = useState<SelectedEdge[]>([]);

  const activeNetwork = networksData?.networks?.[0] || null;

  const handleEdgeSelect = (edge: SelectedEdge) => {
    setSelectedEdges((prev) => {
      if (prev.some((e) => e.edge_id === edge.edge_id)) return prev;
      return [...prev, edge];
    });
  };

  const handleEdgeDeselect = (edgeId: string) => {
    setSelectedEdges((prev) => prev.filter((e) => e.edge_id !== edgeId));
  };

  const handleClearSelection = () => {
    setSelectedEdges([]);
  };

  return (
    <div
      className="min-h-screen px-6 py-6 space-y-6"
      style={{ background: "#06111C", color: "#EAF3F8" }}
    >
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid #1B3445" }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded" style={{ background: "rgba(0,184,217,0.12)", color: "#00B8D9", border: "1px solid rgba(0,184,217,0.3)" }}>
              GEOSPATIAL ROAD NETWORKS
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium"
              style={{ background: "rgba(54,198,160,0.12)", color: "#36C6A0", border: "1px solid rgba(54,198,160,0.3)" }}
            >
              LIVE GIS TOPOLOGY
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
            <span style={{ color: "#00B8D9" }}>🗺️</span> City Digital Twin Network Explorer
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#8DA5B5" }}>
            Explore verified OpenStreetMap road network geometry, link capacities, speeds, and target road segments for simulation interventions.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {selectedEdges.length > 0 && (
            <Link
              href={`/scenarios?network_id=${activeNetwork?.network_id || "jaipur_v1"}&city_id=${selectedCityId}&closures=${selectedEdges.map((e) => e.edge_id).join(",")}`}
              className="px-3 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5"
              style={{ background: "#EF5350", color: "#FFFFFF" }}
            >
              <span>Build Scenario with {selectedEdges.length} Closures →</span>
            </Link>
          )}

          <Link
            href={`/scenarios?network_id=${activeNetwork?.network_id || "jaipur_v1"}&city_id=${selectedCityId}`}
            className="px-3 py-1.5 text-xs font-mono font-medium rounded transition-all"
            style={{ background: "#00B8D9", color: "#06111C" }}
          >
            Create New Scenario
          </Link>
        </div>
      </div>

      {citiesError && (
        <div
          className="p-3 rounded text-xs font-mono"
          style={{ background: "rgba(239,83,80,0.12)", border: "1px solid #EF5350", color: "#EF5350" }}
        >
          Failed to fetch registered cities: {citiesError}. Please confirm FastAPI backend is running.
        </div>
      )}

      {/* Main Grid: Left Controls (1/3) + Right Full Map (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side Panel */}
        <div className="lg:col-span-4 space-y-4">
          {/* City & Network Selector Card */}
          <div
            className="p-4 rounded-lg space-y-3"
            style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
          >
            <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid #1B3445" }}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                Active City Target
              </span>
              <span className="text-[10px] font-mono" style={{ color: "#00B8D9" }}>
                {citiesData?.cities.length || 3} Registered
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {citiesLoading ? (
                <div className="text-xs font-mono" style={{ color: "#8DA5B5" }}>Loading cities...</div>
              ) : (
                citiesData?.cities.map((city) => {
                  const isSelected = selectedCityId === city.city_id;
                  return (
                    <button
                      key={city.city_id}
                      onClick={() => setSelectedCityId(city.city_id)}
                      className="w-full text-left p-3 rounded transition-all"
                      style={{
                        background: isSelected ? "rgba(0,184,217,0.12)" : "rgba(6,17,28,0.5)",
                        border: `1px solid ${isSelected ? "#00B8D9" : "#1B3445"}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{city.name}</span>
                        <span
                          className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(54,198,160,0.12)",
                            color: "#36C6A0",
                            border: "1px solid rgba(54,198,160,0.3)",
                          }}
                        >
                          {city.status}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug" style={{ color: "#8DA5B5" }}>{city.description}</p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Network Verification Metadata */}
            {activeNetwork && (
              <div
                className="p-3 rounded space-y-2 text-xs font-mono"
                style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}
              >
                <div className="flex items-center justify-between pb-1.5" style={{ borderBottom: "1px solid #1B3445" }}>
                  <span style={{ color: "#8DA5B5" }}>Network ID</span>
                  <span className="text-white font-medium">{activeNetwork.network_id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-1.5 rounded" style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}>
                    <div className="text-[9px]" style={{ color: "#8DA5B5" }}>Nodes</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {activeNetwork.node_count.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}>
                    <div className="text-[9px]" style={{ color: "#8DA5B5" }}>Edges</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {activeNetwork.edge_count.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-1.5 rounded" style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}>
                    <div className="text-[9px]" style={{ color: "#8DA5B5" }}>Road Length</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {activeNetwork.total_road_length_km.toFixed(1)} km
                    </div>
                  </div>
                </div>
                <div className="text-[10px] pt-1 flex items-center justify-between" style={{ color: "#8DA5B5" }}>
                  <span>Validation: <b style={{ color: "#36C6A0" }}>{activeNetwork.validation_status}</b></span>
                  <span>Simulation: <b style={{ color: "#00B8D9" }}>Ready</b></span>
                </div>
              </div>
            )}
          </div>

          {/* Layer and Color Controls */}
          <NetworkLayerControls
            colorMode={colorMode}
            onColorModeChange={setColorMode}
            selectedEdges={selectedEdges}
            onClearSelection={handleClearSelection}
          />
        </div>

        {/* Right Map Canvas */}
        <div
          className="lg:col-span-8 rounded-lg overflow-hidden"
          style={{ border: "1px solid #1B3445" }}
        >
          <CityMap
            networkId={activeNetwork?.network_id || "jaipur_v1"}
            colorMode={colorMode}
            selectedEdgeIds={selectedEdges.map((e) => e.edge_id)}
            onEdgeSelect={handleEdgeSelect}
            onEdgeDeselect={handleEdgeDeselect}
            heightClass="h-[750px]"
          />
        </div>
      </div>
    </div>
  );
}
