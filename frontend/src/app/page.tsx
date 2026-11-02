"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TrafficOverviewPanel } from "@/components/panels/TrafficOverviewPanel";
import { AIPanelRight } from "@/components/panels/AIPanelRight";

// Dynamic import with SSR disabled to guarantee smooth WebGL MapLibre rendering
const CityMap = dynamic(
  () => import("@/components/Map/CityMap").then((m) => m.CityMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#06111C] text-[#8DA5B5] gap-3">
        <div className="w-8 h-8 border-2 border-[#00B8D9] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Initializing MapLibre 3D Digital Twin...</span>
      </div>
    ),
  }
);

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
      {/* Full-bleed 3D Digital Twin Viewport */}
      <div className="relative h-full w-full overflow-hidden">
        {/* Central MapLibre 3D Canvas occupies 100% of the screen */}
        <div className="absolute inset-0 w-full h-full">
          <CityMap
            networkId={networkId}
            initialCenter={center}
            initialZoom={13.5}
            colorMode="highway"
            heightClass="h-full"
          />
        </div>

        {/* ── Left Floating Intelligence Panel ─────────────────── */}
        <div
          className="absolute left-3 top-3 z-10 max-h-[calc(100%-24px)] overflow-y-auto pointer-events-auto"
          style={{ width: "215px" }}
        >
          <TrafficOverviewPanel />
        </div>

        {/* ── Right Floating Intelligence Panel ────────────────── */}
        <div
          className="absolute right-3 top-3 z-10 max-h-[calc(100%-24px)] overflow-y-auto pointer-events-auto"
          style={{ width: "215px" }}
        >
          <AIPanelRight />
        </div>

        {/* ── Center Top Floating City Switcher HUD ────────────── */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded"
          style={{
            background: "rgba(6,17,28,0.92)",
            border: "1px solid rgba(0,184,217,0.4)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.8), 0 0 15px rgba(0,184,217,0.2)",
          }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#36C6A0", boxShadow: "0 0 8px #36C6A0" }} />
          <span className="text-xs font-black tracking-wide" style={{ color: "#EAF3F8" }}>
            {selectedCity.toUpperCase()} 3D DIGITAL TWIN
          </span>
          <span
            className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,184,217,0.18)", color: "#00B8D9", border: "1px solid rgba(0,184,217,0.3)" }}
          >
            v1.0 · OPERATIONAL
          </span>
          <div className="h-3.5 w-px mx-1" style={{ background: "#1B3445" }} />
          {(["Jaipur", "Delhi", "Bengaluru"] as const).map((city) => (
            <button
              key={city}
              onClick={() => handleCityChange(city)}
              className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
              style={{
                background: selectedCity === city ? "rgba(0,184,217,0.3)" : "transparent",
                border: selectedCity === city ? "1px solid #00B8D9" : "1px solid transparent",
                color: selectedCity === city ? "#00B8D9" : "#8DA5B5",
              }}
            >
              {city}
            </button>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
