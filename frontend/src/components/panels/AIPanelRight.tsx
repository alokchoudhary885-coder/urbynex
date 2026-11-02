"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * AIPanelRight.tsx
 * Right floating intelligence panel — Air Quality + Agentic AI Insights.
 */

// Circular AQI gauge
function AqiGauge({ aqi }: { aqi: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const maxAqi = 200;
  const pct = Math.min(aqi / maxAqi, 1);
  const offset = circ - pct * circ;
  const color = aqi <= 50 ? "#36C6A0" : aqi <= 100 ? "#F5A623" : "#EF5350";
  const label = aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : "Unhealthy";

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
        <svg width={80} height={80} className="-rotate-90">
          <circle cx={40} cy={40} r={r} fill="none" stroke="#1B3445" strokeWidth={7} />
          <circle
            cx={40} cy={40} r={r}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-black leading-none" style={{ color }}>{aqi}</span>
          <span className="text-[8px] font-medium" style={{ color: "#8DA5B5" }}>{label}</span>
        </div>
      </div>
    </div>
  );
}

const AIR_METRICS = [
  { label: "PM2.5", value: "18 µg/m³" },
  { label: "PM10",  value: "39 µg/m³" },
  { label: "NO₂",   value: "12 ppb"   },
  { label: "O₃",    value: "24 ppb"   },
  { label: "CO",    value: "0.4 ppm"  },
];

const AQI_FORECAST = [
  { time: "Now", aqi: 42, color: "#36C6A0" },
  { time: "6:00", aqi: 46, color: "#36C6A0" },
  { time: "12:00", aqi: 51, color: "#F5A623" },
  { time: "18:00", aqi: 44, color: "#36C6A0" },
];

interface SimRun {
  id: string;
  network_id?: string;
  metrics?: {
    avg_vc_ratio?: number;
    throughput_veh_h?: number;
  };
}

export function AIPanelRight() {
  const [latestRun, setLatestRun] = useState<SimRun | null>(null);
  const [approveClicked, setApproveClicked] = useState(false);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/simulations?limit=1`)
      .then((r) => r.json())
      .then((data: SimRun[]) => { if (data?.length) setLatestRun(data[0]); })
      .catch(() => {});
  }, []);

  const vcRatio = latestRun?.metrics?.avg_vc_ratio;

  return (
    <div
      className="flex flex-col gap-2"
      style={{
        width: "200px",
        background: "#0B1D2B",
        border: "1px solid #1B3445",
        borderRadius: "4px",
        padding: "10px",
        fontSize: "11px",
      }}
    >
      {/* ── AIR QUALITY ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#00B8D9" }}>
          Air Quality
        </span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#F5A623" }} />
          <span className="text-[8px]" style={{ color: "#F5A623" }}>STATIC</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AqiGauge aqi={42} />
        <div className="flex flex-col gap-0.5">
          {AIR_METRICS.map((m) => (
            <div key={m.label} className="flex gap-1 items-center">
              <span style={{ color: "#8DA5B5", fontSize: "8px", width: "28px" }}>{m.label}</span>
              <span style={{ color: "#EAF3F8", fontSize: "8px", fontFamily: "monospace" }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AQI Forecast */}
      <div style={{ borderTop: "1px solid #1B3445" }} className="pt-1.5">
        <div className="text-[8px] font-bold tracking-widest uppercase mb-1" style={{ color: "#8DA5B5" }}>
          AQI Forecast
        </div>
        <div className="grid grid-cols-4 gap-0.5">
          {AQI_FORECAST.map((f) => (
            <div
              key={f.time}
              className="flex flex-col items-center gap-0.5 py-1 rounded"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #1B3445" }}
            >
              <span style={{ color: "#8DA5B5", fontSize: "8px" }}>{f.time}</span>
              <span className="font-bold text-[10px]" style={{ color: f.color }}>{f.aqi}</span>
            </div>
          ))}
        </div>
        <p className="text-[7.5px] mt-1" style={{ color: "#1B3445" }}>
          Live AQI feed not connected — displaying reference values
        </p>
      </div>

      {/* ── AGENTIC AI INSIGHTS ────────────────────────── */}
      <div style={{ borderTop: "1px solid #1B3445" }} className="pt-1.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span>💡</span>
          <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#00B8D9" }}>
            Agentic AI Insights
          </span>
        </div>

        {/* Recommended Action */}
        <div
          className="rounded p-1.5 mb-1.5"
          style={{ background: "rgba(0,184,217,0.07)", border: "1px solid rgba(0,184,217,0.2)" }}
        >
          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: "#8DA5B5" }}>
            Recommended Action
          </div>
          <p style={{ color: "#EAF3F8", fontSize: "8.5px", lineHeight: "1.4" }}>
            {vcRatio !== undefined && vcRatio !== null
              ? vcRatio > 0.7
                ? "Increase signal green-split on primary corridors by 15% during peak hours to reduce congestion by ~8%."
                : "Network flow is balanced. Consider demand management on secondary roads."
              : "Run a simulation to generate AI-powered recommendations."}
          </p>
        </div>

        {/* Predictive Impact */}
        <div className="text-[8px] font-bold uppercase mb-1" style={{ color: "#8DA5B5" }}>
          Predictive Impact
        </div>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {[
            { label: "Congestion", val: "-8%",  color: "#36C6A0" },
            { label: "Ridership",  val: "+12%", color: "#00B8D9" },
            { label: "Emissions", val: "-4%",  color: "#36C6A0" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded"
              style={{ background: "#06111C", border: "1px solid #1B3445" }}
            >
              <span className="text-[11px] font-black" style={{ color: item.color }}>{item.val}</span>
              <span className="text-[7.5px]" style={{ color: "#8DA5B5" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Approve Action Button */}
        <button
          onClick={() => setApproveClicked(true)}
          className="w-full py-1.5 rounded text-[9px] font-bold tracking-wide mb-1.5 transition-all"
          style={{
            background: approveClicked ? "rgba(54,198,160,0.3)" : "rgba(54,198,160,0.15)",
            border: `1px solid ${approveClicked ? "#36C6A0" : "rgba(54,198,160,0.4)"}`,
            color: "#36C6A0",
          }}
        >
          {approveClicked ? "✓ Action Approved" : "Approve Action"}
        </button>

        <Link
          href="/ai"
          className="block text-center text-[8.5px] font-medium"
          style={{ color: "#8DA5B5" }}
        >
          See All AI Recommendations →
        </Link>
      </div>

      {/* Quick links */}
      <div style={{ borderTop: "1px solid #1B3445" }} className="pt-1.5 grid grid-cols-2 gap-1">
        <Link
          href="/simulations"
          className="text-center py-1 rounded text-[8px] font-medium"
          style={{ background: "#06111C", border: "1px solid #1B3445", color: "#8DA5B5" }}
        >
          Simulations
        </Link>
        <Link
          href="/compare"
          className="text-center py-1 rounded text-[8px] font-medium"
          style={{ background: "#06111C", border: "1px solid #1B3445", color: "#8DA5B5" }}
        >
          Compare Runs
        </Link>
      </div>
    </div>
  );
}
