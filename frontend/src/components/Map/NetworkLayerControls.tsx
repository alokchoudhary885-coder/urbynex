"use client";

import React from "react";
import type { ColorMode, SelectedEdge } from "./CityMap";

interface NetworkLayerControlsProps {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  selectedEdges: SelectedEdge[];
  onClearSelection: () => void;
  onQuickZoom?: (name: string, coords: [number, number], zoom: number) => void;
}

const QUICK_LOCATIONS: { name: string; coords: [number, number]; zoom: number; desc: string }[] = [
  { name: "Jaipur Center", coords: [75.7873, 26.9124], zoom: 13, desc: "City wide view" },
  { name: "MI Road Corridor", coords: [75.8055, 26.9189], zoom: 15, desc: "Commercial artery" },
  { name: "JLN Marg", coords: [75.8142, 26.8920], zoom: 14.5, desc: "North-South transit" },
  { name: "Amer Road", coords: [75.8344, 26.9421], zoom: 14.5, desc: "Historic corridor" },
];

export function NetworkLayerControls({
  colorMode,
  onColorModeChange,
  selectedEdges,
  onClearSelection,
  onQuickZoom,
}: NetworkLayerControlsProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-6">
      {/* Layer Coloring Mode */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Road Color Coding
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "highway", label: "Road Hierarchy" },
              { id: "speed", label: "Speed Limit" },
              { id: "capacity", label: "Link Capacity" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => onColorModeChange(m.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all border ${
                colorMode === m.id
                  ? "bg-emerald-600/20 border-emerald-500/80 text-emerald-300 font-semibold"
                  : "bg-gray-800/80 border-gray-700/60 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Legend */}
      <div className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-3.5 space-y-2 text-xs">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block">
          Legend ({colorMode})
        </span>

        {colorMode === "highway" && (
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#f59e0b]" />
              <span>Trunk Arterials</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#10b981]" />
              <span>Primary Roads</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#06b6d4]" />
              <span>Secondary Corridors</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#3b82f6]" />
              <span>Tertiary Feeders</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#64748b]" />
              <span>Residential Streets</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded bg-[#ef4444]" />
              <span>Targeted Interventions</span>
            </div>
          </div>
        )}

        {colorMode === "speed" && (
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#38bdf8]" />
              <span>&lt; 30 km/h (Slow)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#34d399]" />
              <span>30 - 50 km/h (Urban)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#fbbf24]" />
              <span>50 - 65 km/h (Express)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#f87171]" />
              <span>&gt; 65 km/h (High Speed)</span>
            </div>
          </div>
        )}

        {colorMode === "capacity" && (
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#94a3b8]" />
              <span>≤ 1,800 veh/hr</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#38bdf8]" />
              <span>1,801 - 3,600 veh/hr</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#818cf8]" />
              <span>3,601 - 5,400 veh/hr</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 rounded bg-[#c084fc]" />
              <span>&gt; 5,400 veh/hr</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Corridor Focus */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Major Corridors Focus
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_LOCATIONS.map((loc) => (
            <button
              key={loc.name}
              onClick={() => onQuickZoom?.(loc.name, loc.coords, loc.zoom)}
              className="text-left p-2.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 transition-colors group"
            >
              <div className="text-xs font-medium text-gray-200 group-hover:text-emerald-400">
                {loc.name}
              </div>
              <div className="text-[10px] text-gray-500">{loc.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Segments List */}
      {selectedEdges.length > 0 && (
        <div className="border-t border-gray-800 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-300">
              Selected Interventions ({selectedEdges.length})
            </span>
            <button
              onClick={onClearSelection}
              className="text-[11px] text-gray-400 hover:text-red-400 underline"
            >
              Clear All
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {selectedEdges.map((e) => (
              <div
                key={e.edge_id}
                className="flex items-center justify-between p-2 rounded bg-red-950/40 border border-red-900/60"
              >
                <div>
                  <div className="font-medium text-gray-200">{e.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{e.edge_id}</div>
                </div>
                <div className="text-[10px] text-red-400 font-medium">
                  {e.length_m.toFixed(0)}m
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
