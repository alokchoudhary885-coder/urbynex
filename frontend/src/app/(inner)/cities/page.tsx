"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCities, useCityNetworks } from "@/lib/hooks/useApi";
import { CityMap, type ColorMode, type SelectedEdge } from "@/components/Map/CityMap";
import { NetworkLayerControls } from "@/components/Map/NetworkLayerControls";

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
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              City Digital Twin Explorer
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 border border-emerald-800 text-emerald-400">
              Live GIS Network
            </span>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Explore verified OpenStreetMap road network geometry, link capacities, speeds, and target road segments for simulation interventions.
          </p>
        </div>

        {/* Action button to launch scenario with selected edges */}
        <div className="flex items-center gap-3">
          {selectedEdges.length > 0 && (
            <Link
              href={`/scenarios?network_id=${activeNetwork?.network_id || "jaipur_v1"}&city_id=${selectedCityId}&closures=${selectedEdges.map((e) => e.edge_id).join(",")}`}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-950 flex items-center gap-2"
            >
              <span>Build Scenario with {selectedEdges.length} Closures</span>
              <span>→</span>
            </Link>
          )}

          <Link
            href={`/scenarios?network_id=${activeNetwork?.network_id || "jaipur_v1"}&city_id=${selectedCityId}`}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-950"
          >
            Create New Scenario
          </Link>
        </div>
      </div>

      {citiesError && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 text-xs px-4 py-3 rounded-xl">
          Failed to fetch registered cities: {citiesError}. Please confirm FastAPI backend is running.
        </div>
      )}

      {/* Main Grid: Left Controls (1/3) + Right Full Map (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* City & Network Selector Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Active City Target
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                {citiesData?.cities.length || 1} Registered
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {citiesLoading ? (
                <div className="text-xs text-gray-500">Loading cities...</div>
              ) : (
                citiesData?.cities.map((city) => (
                  <button
                    key={city.city_id}
                    onClick={() => setSelectedCityId(city.city_id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      selectedCityId === city.city_id
                        ? "bg-gray-800/90 border-emerald-500/80 shadow-md"
                        : "bg-gray-950/50 border-gray-800 hover:bg-gray-850 text-gray-400"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-100">{city.name}</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                        {city.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-snug">{city.description}</p>
                  </button>
                ))
              )}
            </div>

            {/* Network Verification Metadata */}
            {activeNetwork && (
              <div className="bg-gray-950/70 border border-gray-800/80 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
                  <span className="text-gray-400 font-medium">Network ID</span>
                  <span className="font-mono text-emerald-400">{activeNetwork.network_id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/60">
                    <div className="text-[10px] text-gray-500">Nodes</div>
                    <div className="text-sm font-bold text-white font-mono">
                      {activeNetwork.node_count.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/60">
                    <div className="text-[10px] text-gray-500">Edges</div>
                    <div className="text-sm font-bold text-white font-mono">
                      {activeNetwork.edge_count.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/60">
                    <div className="text-[10px] text-gray-500">Total Length</div>
                    <div className="text-sm font-bold text-white font-mono">
                      {activeNetwork.total_road_length_km.toFixed(1)} km
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-gray-500 pt-1 flex items-center justify-between">
                  <span>Validation: <b className="text-emerald-400">{activeNetwork.validation_status}</b></span>
                  <span>Simulation: <b className="text-emerald-400">Ready</b></span>
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
        <div className="lg:col-span-8">
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
