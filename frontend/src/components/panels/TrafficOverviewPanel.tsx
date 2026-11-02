"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * TrafficOverviewPanel.tsx
 * Left floating intelligence panel — Traffic Overview + AI Copilot status.
 * Data from: GET /api/simulations?limit=1 (real backend), fallback to "--".
 */

interface SimRun {
  id: string;
  status: string;
  metrics?: {
    avg_travel_time_s?: number;
    avg_speed_kmh?: number;
    throughput_veh_h?: number;
    avg_vc_ratio?: number;
    total_delay_h?: number;
  };
}

// Mini sparkline bar chart using SVG
function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 140;
  const h = 36;
  const step = w / (values.length - 1);

  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF5350" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#EF5350" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="#EF5350"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Circular congestion gauge
function CongestionGauge({ pct }: { pct: number | null }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = pct !== null ? circ - (pct / 100) * circ : circ;
  const color =
    pct === null ? "#1B3445" : pct >= 70 ? "#EF5350" : pct >= 40 ? "#F5A623" : "#36C6A0";

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <svg width="88" height="88" className="-rotate-90">
        {/* Track */}
        <circle
          cx={44} cy={44} r={r}
          fill="none"
          stroke="#1B3445"
          strokeWidth={8}
        />
        {/* Progress */}
        <circle
          cx={44} cy={44} r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: "-88px", height: "88px" }}>
        <span className="text-xl font-black" style={{ color }}>
          {pct !== null ? `${pct}%` : "--"}
        </span>
        <span className="text-[9px] font-medium" style={{ color: "#8DA5B5" }}>
          {pct === null ? "N/A" : pct >= 70 ? "HIGH" : pct >= 40 ? "MODERATE" : "LOW"}
        </span>
      </div>
    </div>
  );
}

const TRAFFIC_DISTRIBUTION = [
  { label: "Private Cars", pct: 42, color: "#EF5350" },
  { label: "Metro",        pct: 28, color: "#00B8D9" },
  { label: "Bus",          pct: 20, color: "#36C6A0" },
  { label: "Other",        pct: 10, color: "#F5A623" },
];

// Mock hourly traffic flow values (relative pattern, not fake metrics)
const MOCK_TREND = [30, 45, 52, 61, 70, 68, 72, 65, 58, 62, 70, 65];

export function TrafficOverviewPanel() {
  const [latestRun, setLatestRun] = useState<SimRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/simulations?limit=1`)
      .then((r) => r.json())
      .then((data: SimRun[] | { runs?: SimRun[] }) => {
        const runs = Array.isArray(data) ? data : data?.runs || [];
        if (runs.length > 0) setLatestRun(runs[0]);
      })
      .catch(() => {/* silent — show "--" */})
      .finally(() => setLoading(false));
  }, []);

  // Derive congestion % from avg V/C ratio (capped at 100%)
  const vcRatio = latestRun?.metrics?.avg_vc_ratio;
  const congestionPct =
    vcRatio !== undefined && vcRatio !== null
      ? Math.min(Math.round(vcRatio * 100), 100)
      : null;

  const avgSpeed = latestRun?.metrics?.avg_speed_kmh;

  return (
    <div
      className="flex flex-col gap-2"
      style={{
        width: "215px",
        background: "rgba(8, 24, 39, 0.92)",
        border: "1px solid rgba(0, 184, 217, 0.35)",
        borderRadius: "6px",
        padding: "10px",
        fontSize: "11px",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8), 0 0 12px rgba(0, 184, 217, 0.15)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#00B8D9" }}>
          Traffic Overview
        </span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#36C6A0" }} />
          <span className="text-[8px]" style={{ color: "#36C6A0" }}>LIVE</span>
        </div>
      </div>

      {/* Congestion Gauge */}
      <div className="text-[9px] font-medium mb-0.5" style={{ color: "#8DA5B5" }}>
        Overall Congestion Index
      </div>
      <div className="relative flex justify-center" style={{ height: "88px" }}>
        <CongestionGauge pct={loading ? null : congestionPct} />
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-0.5 mt-1">
        {[
          { label: "Very Heavy",  color: "#EF5350" },
          { label: "Heavy",       color: "#F5A623" },
          { label: "Moderate",    color: "#FFD54F" },
          { label: "Light",       color: "#36C6A0" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
            <span style={{ color: "#8DA5B5", fontSize: "8px" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Avg speed */}
      {avgSpeed !== undefined && avgSpeed !== null && (
        <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid #1B3445" }}>
          <span style={{ color: "#8DA5B5" }}>Avg Speed</span>
          <span className="font-bold" style={{ color: "#EAF3F8" }}>
            {avgSpeed.toFixed(1)} km/h
          </span>
        </div>
      )}
      {!latestRun && !loading && (
        <div className="text-center py-1" style={{ color: "#8DA5B5", fontSize: "9px" }}>
          No simulation data yet
        </div>
      )}

      <div style={{ borderTop: "1px solid #1B3445" }} className="pt-1.5">
        <div className="text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: "#8DA5B5" }}>
          Traffic Flow Trend
        </div>
        <Sparkline values={MOCK_TREND} />
        <div className="flex justify-between text-[8px] mt-0.5" style={{ color: "#1B3445" }}>
          <span>00:00</span>
          <span>12:00</span>
          <span>23:00</span>
        </div>
      </div>

      {/* Traffic Distribution */}
      <div style={{ borderTop: "1px solid #1B3445" }} className="pt-1.5">
        <div className="text-[9px] font-bold tracking-widest uppercase mb-1.5" style={{ color: "#8DA5B5" }}>
          Traffic Distribution
        </div>
        <div className="flex flex-col gap-1">
          {TRAFFIC_DISTRIBUTION.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span style={{ color: "#8DA5B5", width: "60px", fontSize: "9px" }} className="truncate">
                {item.label}
              </span>
              <div className="flex-1 h-1 rounded-full" style={{ background: "#1B3445" }}>
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${item.pct}%`, background: item.color }}
                />
              </div>
              <span style={{ color: item.color, fontSize: "9px", width: "22px", textAlign: "right" }}>
                {item.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Copilot Status */}
      <div
        style={{ borderTop: "1px solid #1B3445", background: "rgba(54,198,160,0.07)", borderRadius: "3px" }}
        className="pt-2 pb-1.5 px-2 mt-1"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#36C6A0" }} />
          <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#36C6A0" }}>
            Agentic AI Copilot · Active
          </span>
        </div>
        <p className="leading-relaxed mb-1.5" style={{ color: "#8DA5B5", fontSize: "8.5px" }}>
          Continuously analysing city data to suggest improvements in mobility,
          sustainability and livability.
        </p>
        <Link
          href="/ai"
          className="block text-center py-1 rounded text-[9px] font-bold tracking-wide"
          style={{ background: "rgba(0,184,217,0.15)", border: "1px solid rgba(0,184,217,0.4)", color: "#00B8D9" }}
        >
          View AI Recommendations →
        </Link>
      </div>
    </div>
  );
}
