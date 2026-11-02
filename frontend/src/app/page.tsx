"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CityMap } from "@/components/Map/CityMap";
import { TrafficOverviewPanel } from "@/components/panels/TrafficOverviewPanel";
import { AIPanelRight } from "@/components/panels/AIPanelRight";

/**
 * page.tsx — Urbynex Smart City Command Center Dashboard
 *
 * Layout (matching the Dubai Digital Twin reference):
 *   [Left Panel | Central MapLibre Map | Right Panel]
 *
 * All data from real backend. No fabricated metrics.
 */

const CITY_TO_NETWORK: Record<string, string> = {
  Jaipur: "jaipur_v1",
  Delhi:  "delhi_v1",
  Bengaluru: "bengaluru_v1",
};

const CITY_CENTERS: Record<string, [number, number]> = {
  Jaipur: [75.7873, 26.9124],
  Delhi:  [77.2090, 28.6139],
  Bengaluru: [77.6245, 12.9172],
};

export default function CommandCenterPage() {
  const [selectedCity, setSelectedCity] = useState("Jaipur");
  const networkId = CITY_TO_NETWORK[selectedCity] ?? "jaipur_v1";
  const center    = CITY_CENTERS[selectedCity] ?? [75.7873, 26.9124];

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
  };

  return (
    <DashboardLayout
      networkId={networkId}
      selectedCity={selectedCity}
      onCityChange={handleCityChange}
      cities={["Jaipur", "Delhi", "Bengaluru"]}
    >
      {/* Three-column layout: Left Panel | Map | Right Panel */}
      <div className="flex h-full w-full overflow-hidden" style={{ gap: "6px", padding: "6px" }}>

        {/* ── Left Intelligence Panel ─────────────────── */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{ zIndex: 10 }}
        >
          <TrafficOverviewPanel />
        </div>

        {/* ── Central Map ────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden" style={{ borderRadius: "4px", border: "1px solid #1B3445" }}>
          {/* Map fills this area */}
          <CityMap
            networkId={networkId}
            initialCenter={center}
            initialZoom={13}
            colorMode="highway"
            heightClass="h-full"
          />

          {/* City label overlay */}
          <div
            className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded"
            style={{ background: "rgba(8,24,39,0.85)", border: "1px solid #1B3445", backdropFilter: "blur(4px)" }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: "#36C6A0", boxShadow: "0 0 6px #36C6A0" }} />
            <span className="text-xs font-bold" style={{ color: "#EAF3F8" }}>{selectedCity} Digital Twin</span>
            <span
              className="text-[8px] font-mono px-1 py-0.5 rounded"
              style={{ background: "rgba(0,184,217,0.15)", color: "#00B8D9", border: "1px solid rgba(0,184,217,0.3)" }}
            >
              v1 · LIVE
            </span>
          </div>

          {/* Map legend overlay */}
          <div
            className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 p-2 rounded"
            style={{ background: "rgba(8,24,39,0.85)", border: "1px solid #1B3445", backdropFilter: "blur(4px)", fontSize: "9px" }}
          >
            <div className="font-bold mb-0.5" style={{ color: "#8DA5B5" }}>ROAD TYPE</div>
            {[
              { color: "#f59e0b", label: "Trunk / Expressway" },
              { color: "#10b981", label: "Primary" },
              { color: "#06b6d4", label: "Secondary" },
              { color: "#3b82f6", label: "Tertiary" },
              { color: "#64748b", label: "Residential" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded-full" style={{ background: l.color }} />
                <span style={{ color: "#8DA5B5" }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Quick navigation buttons overlay */}
          <div
            className="absolute top-3 right-14 z-10 flex gap-1"
          >
            {(["Jaipur", "Delhi", "Bengaluru"] as const).map((city) => (
              <button
                key={city}
                onClick={() => handleCityChange(city)}
                className="px-2 py-1 rounded text-[9px] font-bold transition-all"
                style={{
                  background: selectedCity === city ? "rgba(0,184,217,0.25)" : "rgba(8,24,39,0.85)",
                  border: `1px solid ${selectedCity === city ? "#00B8D9" : "#1B3445"}`,
                  color: selectedCity === city ? "#00B8D9" : "#8DA5B5",
                  backdropFilter: "blur(4px)",
                }}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right Intelligence Panel ────────────────── */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{ zIndex: 10 }}
        >
          <AIPanelRight />
        </div>
      </div>
    </DashboardLayout>
  );
}
