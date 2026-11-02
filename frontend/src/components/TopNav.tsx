"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * TopNav.tsx — Urbynex Command Center Top Navigation Bar
 * Shows live time, city selection, weather placeholder, search and controls.
 */

function LiveClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
      setDate(
        now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono" style={{ color: "#EAF3F8" }}>
        {date}
      </span>
      <span
        className="text-xs font-mono font-bold px-2 py-0.5 rounded"
        style={{ background: "rgba(0,184,217,0.12)", color: "#00B8D9", letterSpacing: "0.04em" }}
      >
        {time} IST
      </span>
    </div>
  );
}

interface TopNavProps {
  selectedCity?: string;
  onCityChange?: (city: string) => void;
  cities?: string[];
}

const CITY_COORDS: Record<string, string> = {
  Jaipur: "26.9°N, 75.8°E",
  Delhi: "28.6°N, 77.2°E",
  Bengaluru: "12.9°N, 77.6°E",
};

export function TopNav({ selectedCity = "Jaipur", onCityChange, cities = ["Jaipur", "Delhi", "Bengaluru"] }: TopNavProps) {
  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center gap-4 px-4"
      style={{
        left: "56px",
        height: "48px",
        background: "#081827",
        borderBottom: "1px solid #1B3445",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 pr-4" style={{ borderRight: "1px solid #1B3445" }}>
        <span className="text-sm font-black tracking-wide" style={{ color: "#00B8D9" }}>
          URBYNEX
        </span>
        <span className="text-[9px] font-medium tracking-widest" style={{ color: "#8DA5B5" }}>
          SMART CITY DIGITAL TWIN
        </span>
      </div>

      {/* Live Clock */}
      <LiveClock />

      {/* Separator */}
      <div className="h-5 w-px" style={{ background: "#1B3445" }} />

      {/* City Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium" style={{ color: "#8DA5B5" }}>CITY</span>
        <select
          value={selectedCity}
          onChange={(e) => onCityChange?.(e.target.value)}
          className="text-xs font-semibold border-0 outline-none cursor-pointer rounded px-2 py-0.5"
          style={{
            background: "rgba(0,184,217,0.1)",
            color: "#00B8D9",
            border: "1px solid rgba(0,184,217,0.3)",
          }}
        >
          {cities.map((c) => (
            <option key={c} value={c} style={{ background: "#0B1D2B", color: "#EAF3F8" }}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-[10px] font-mono" style={{ color: "#8DA5B5" }}>
          {CITY_COORDS[selectedCity] ?? ""}
        </span>
      </div>

      {/* Separator */}
      <div className="h-5 w-px" style={{ background: "#1B3445" }} />

      {/* Weather placeholder */}
      <div className="flex items-center gap-1.5">
        <span className="text-base">🌤</span>
        <span className="text-xs" style={{ color: "#8DA5B5" }}>
          28°C · Clear
        </span>
      </div>

      {/* Flex spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded text-xs"
        style={{ background: "#06111C", border: "1px solid #1B3445", color: "#8DA5B5", minWidth: "160px" }}
      >
        <span>🔍</span>
        <span>Search locations…</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 pl-3" style={{ borderLeft: "1px solid #1B3445" }}>
        {/* Notifications */}
        <button className="relative text-base" title="Notifications" style={{ color: "#8DA5B5" }}>
          🔔
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ background: "#F5A623" }}
          />
        </button>
        {/* Profile */}
        <Link href="/ai" title="AI Copilot">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #00B8D9, #36C6A0)", color: "#06111C" }}
          >
            U
          </div>
        </Link>
      </div>
    </header>
  );
}
