"use client";

/**
 * frontend/src/app/(inner)/simulations/page.tsx
 *
 * Command Center Simulation Monitor & Analytics
 * - Real-time job queue & worker telemetry (Celery/BackgroundTask)
 * - Auto-refreshing list of simulation runs with multi-city filter
 * - Detailed metric inspector with visual gauges & corridor breakdown
 * - Quick action links to compare runs
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api/client";
import type {
  SimulationRunStatus,
  SimulationMetrics,
  WorkerStatus,
  RunStatus,
} from "@/lib/api/types";

// ── Metric descriptions & thresholds ────────────────────────────────────────

const METRIC_CONFIG: Record<
  string,
  { label: string; unit: string; maxVal: number; inverse?: boolean }
> = {
  completed_trips: { label: "Completed Trips", unit: "veh", maxVal: 5000 },
  avg_travel_time_s: {
    label: "Avg Travel Time",
    unit: "s",
    maxVal: 600,
    inverse: true,
  },
  avg_waiting_time_s: {
    label: "Avg Waiting Time",
    unit: "s",
    maxVal: 180,
    inverse: true,
  },
  avg_distance_m: { label: "Avg Trip Distance", unit: "m", maxVal: 5000 },
  avg_speed_kmh: { label: "Average Speed", unit: "km/h", maxVal: 60 },
  throughput_veh_per_hr: {
    label: "Network Throughput",
    unit: "veh/h",
    maxVal: 10000,
  },
  routing_failures: {
    label: "Routing Failures",
    unit: "veh",
    maxVal: 50,
    inverse: true,
  },
  congestion_index: {
    label: "Congestion Index",
    unit: "ratio",
    maxVal: 3.0,
    inverse: true,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RunStatus }) {
  const styles: Record<RunStatus, { bg: string; text: string; border: string; dot: string }> = {
    completed: { bg: "rgba(54,198,160,0.12)", text: "#36C6A0", border: "rgba(54,198,160,0.3)", dot: "#36C6A0" },
    running: { bg: "rgba(0,184,217,0.12)", text: "#00B8D9", border: "rgba(0,184,217,0.3)", dot: "#00B8D9" },
    queued: { bg: "rgba(245,166,35,0.12)", text: "#F5A623", border: "rgba(245,166,35,0.3)", dot: "#F5A623" },
    failed: { bg: "rgba(239,83,80,0.12)", text: "#EF5350", border: "rgba(239,83,80,0.3)", dot: "#EF5350" },
    cancelled: { bg: "rgba(141,165,181,0.12)", text: "#8DA5B5", border: "rgba(141,165,181,0.3)", dot: "#8DA5B5" },
  };
  const s = styles[status] ?? styles.queued;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: s.dot }}
      />
      {status.toUpperCase()}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SimulationsPage() {
  const [runs, setRuns] = useState<SimulationRunStatus[]>([]);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");

  // Fetch runs list and worker status
  const refreshData = useCallback(async () => {
    try {
      const [runsRes, workerRes] = await Promise.allSettled([
        api.listSimulations(30),
        api.getWorkerStatus(),
      ]);

      if (runsRes.status === "fulfilled") {
        setRuns(runsRes.value.runs);
      }
      if (workerRes.status === "fulfilled") {
        setWorker(workerRes.value);
      }
    } catch (e) {
      console.error("Failed to refresh runs:", e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshData();
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

  // Load metrics when a run is selected
  async function selectRun(runId: string) {
    setSelectedRunId(runId);
    setLoadingMetrics(true);
    setError(null);
    try {
      const res = await api.getSimulationMetrics(runId);
      setMetrics(res);
    } catch (err) {
      setMetrics(null);
      setError(err instanceof ApiClientError ? err.body.message : String(err));
    } finally {
      setLoadingMetrics(false);
    }
  }

  function handleManualLookup(e: React.FormEvent) {
    e.preventDefault();
    if (manualInput.trim()) {
      selectRun(manualInput.trim());
    }
  }

  const filteredRuns = runs.filter((r) => {
    if (cityFilter === "all") return true;
    return r.network_id.toLowerCase().includes(cityFilter.toLowerCase());
  });

  return (
    <div
      className="min-h-screen px-6 py-6 space-y-6"
      style={{ background: "#06111C", color: "#EAF3F8" }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid #1B3445" }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded" style={{ background: "rgba(0,184,217,0.12)", color: "#00B8D9", border: "1px solid rgba(0,184,217,0.3)" }}>
              DIGITAL TWIN TELEMETRY
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
            <span style={{ color: "#00B8D9" }}>⚡</span> Simulation Monitor &amp; Batch Analytics
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#8DA5B5" }}>
            Real-time execution queue, BPR/Webster convergence, and link-level congestion telemetry.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="px-3 py-1.5 rounded text-xs font-mono transition-all flex items-center gap-2"
            style={{
              background: autoRefresh ? "rgba(54,198,160,0.15)" : "#0B1D2B",
              border: `1px solid ${autoRefresh ? "#36C6A0" : "#1B3445"}`,
              color: autoRefresh ? "#36C6A0" : "#8DA5B5",
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${autoRefresh ? "animate-ping" : ""}`}
              style={{ background: autoRefresh ? "#36C6A0" : "#8DA5B5" }}
            />
            {autoRefresh ? "Live Polling ON" : "Polling Paused"}
          </button>
          <button
            onClick={() => refreshData()}
            className="px-3 py-1.5 text-xs font-mono rounded transition-colors"
            style={{
              background: "#0B1D2B",
              border: "1px solid #1B3445",
              color: "#00B8D9",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Worker Queue Status Banner */}
      {worker && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg"
          style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
        >
          <div>
            <p className="text-[10px] font-mono uppercase" style={{ color: "#8DA5B5" }}>Dispatch Architecture</p>
            <p className="text-xs font-semibold font-mono mt-1 capitalize text-white">
              {worker.dispatch_mode.replace(/_/g, " ")}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase" style={{ color: "#8DA5B5" }}>Queue Broker Status</p>
            <p className="text-xs font-semibold mt-1 flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: worker.redis_available ? "#36C6A0" : "#F5A623" }}
              />
              <span
                className="font-mono text-xs"
                style={{ color: worker.redis_available ? "#36C6A0" : "#F5A623" }}
              >
                {worker.redis_available ? "Redis Live (Distributed)" : "In-Process Async Fallback"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase" style={{ color: "#8DA5B5" }}>Active Compute Nodes</p>
            <p className="text-xs font-mono font-semibold text-white mt-1">
              {worker.celery_workers.length} nodes registered
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase" style={{ color: "#8DA5B5" }}>Task Broker URL</p>
            <p className="text-[11px] font-mono mt-1 truncate" style={{ color: "#8DA5B5" }}>
              {worker.broker_url}
            </p>
          </div>
        </div>
      )}

      {/* Manual lookup input & City Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <form onSubmit={handleManualLookup} className="flex-1 flex gap-2">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Lookup specific run ID: run_1234567890_abc123"
            className="flex-1 px-3 py-2 rounded text-xs font-mono outline-none transition-colors"
            style={{
              background: "#0B1D2B",
              border: "1px solid #1B3445",
              color: "#EAF3F8",
            }}
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="px-4 py-2 text-xs font-medium font-mono rounded transition-colors disabled:opacity-50"
            style={{
              background: "#00B8D9",
              color: "#06111C",
            }}
          >
            Inspect
          </button>
        </form>

        {/* City Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded" style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}>
          {[
            { id: "all", label: "All Cities" },
            { id: "jaipur", label: "Jaipur" },
            { id: "delhi", label: "Delhi" },
            { id: "bengaluru", label: "Bengaluru" },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setCityFilter(c.id)}
              className="px-2.5 py-1 text-[11px] font-medium font-mono rounded transition-colors"
              style={{
                background: cityFilter === c.id ? "#00B8D9" : "transparent",
                color: cityFilter === c.id ? "#06111C" : "#8DA5B5",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="p-3 rounded text-xs font-mono"
          style={{ background: "rgba(239,83,80,0.12)", border: "1px solid #EF5350", color: "#EF5350" }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Main Grid: Run Queue on Left, Details/Analytics on Right */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recent Runs List (5 cols) */}
        <div
          className="lg:col-span-5 p-4 rounded-lg space-y-3"
          style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
        >
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid #1B3445" }}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Execution Queue</h2>
            <span className="text-[11px] font-mono" style={{ color: "#8DA5B5" }}>
              {filteredRuns.length} runs
            </span>
          </div>

          {loadingList ? (
            <div className="py-12 text-center text-xs font-mono" style={{ color: "#8DA5B5" }}>
              Loading simulation runs…
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="py-12 text-center text-xs space-y-2" style={{ color: "#8DA5B5" }}>
              <p>No simulations found for this filter.</p>
              <Link
                href="/scenarios"
                className="text-xs font-medium"
                style={{ color: "#00B8D9" }}
              >
                Launch a scenario simulation →
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredRuns.map((r) => {
                const isSelected = selectedRunId === r.run_id;
                return (
                  <button
                    key={r.run_id}
                    onClick={() => selectRun(r.run_id)}
                    className="w-full text-left p-3 rounded transition-all"
                    style={{
                      background: isSelected ? "rgba(0,184,217,0.12)" : "rgba(6,17,28,0.5)",
                      border: `1px solid ${isSelected ? "#00B8D9" : "#1B3445"}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <StatusBadge status={r.status} />
                      <span className="text-[11px] font-mono" style={{ color: "#8DA5B5" }}>
                        {r.execution_time_seconds != null
                          ? `${r.execution_time_seconds.toFixed(2)}s`
                          : "in queue"}
                      </span>
                    </div>

                    <div className="font-mono text-xs text-white truncate font-medium">
                      {r.run_id}
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-1.5 font-mono" style={{ color: "#8DA5B5" }}>
                      <span>Seed: {r.seed}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.05)", color: "#00B8D9" }}>
                        {r.network_id.replace("_v1", "").toUpperCase()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Run Analytics (7 cols) */}
        <div className="lg:col-span-7">
          {loadingMetrics ? (
            <div
              className="p-12 text-center space-y-3 rounded-lg"
              style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
            >
              <div
                className="w-7 h-7 border-2 rounded-full animate-spin mx-auto"
                style={{ borderColor: "#00B8D9", borderTopColor: "transparent" }}
              />
              <p className="text-xs font-mono" style={{ color: "#8DA5B5" }}>Loading telemetry &amp; metrics…</p>
            </div>
          ) : metrics ? (
            <DetailedMetricsView metrics={metrics} />
          ) : (
            <div
              className="p-12 text-center space-y-3 rounded-lg"
              style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
            >
              <div className="text-3xl">📊</div>
              <h3 className="text-sm font-semibold text-white">
                Select a simulation run
              </h3>
              <p className="text-xs max-w-md mx-auto" style={{ color: "#8DA5B5" }}>
                Choose any run from the execution queue on the left or enter a Run ID above
                to inspect BPR convergence, delay statistics, and link-level
                telemetry.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detailed Metrics Panel Component ─────────────────────────────────────────

function DetailedMetricsView({ metrics }: { metrics: SimulationMetrics }) {
  const edgeList = metrics.edge_metrics
    ? Object.values(metrics.edge_metrics)
    : [];
  const congestedEdges = edgeList.filter((e) => e.congested);

  return (
    <div className="space-y-4">
      {/* Run Header Banner */}
      <div
        className="p-5 rounded-lg"
        style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div>
            <span className="text-[10px] font-mono uppercase" style={{ color: "#00B8D9" }}>
              Run Telemetry Inspector
            </span>
            <h2 className="font-mono text-base font-bold text-white mt-0.5">
              {metrics.run_id}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={metrics.status} />
            <span
              className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
              style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}
            >
              {metrics.data_label}
            </span>
          </div>
        </div>

        {/* Metadata pills */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-3"
          style={{ borderTop: "1px solid #1B3445" }}
        >
          <div>
            <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Engine:</span>
            <span className="text-white font-medium">{metrics.engine}</span>
          </div>
          <div>
            <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Corridor:</span>
            <span className="text-white font-medium">{metrics.network_id}</span>
          </div>
          <div>
            <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Execution:</span>
            <span className="text-white font-medium">
              {metrics.execution_time_seconds != null
                ? `${metrics.execution_time_seconds.toFixed(2)}s`
                : "N/A"}
            </span>
          </div>
          <div>
            <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Random Seed:</span>
            <span className="text-white font-medium">{metrics.seed}</span>
          </div>
        </div>

        {/* Quick action button to compare */}
        <div className="mt-3 pt-2.5 flex justify-end" style={{ borderTop: "1px solid #1B3445" }}>
          <Link
            href="/compare"
            className="text-xs font-mono transition-colors flex items-center gap-1.5"
            style={{ color: "#00B8D9" }}
          >
            ⚖ Compare this run against baseline or scenario →
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid with Visual Gauges */}
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
          const item = metrics.metrics[key];
          if (!item) return null;

          const numVal = typeof item.value === "number" ? item.value : 0;
          const ratio = Math.min(1, Math.max(0, numVal / cfg.maxVal));
          const pct = Math.round(ratio * 100);

          // Color calculation
          const isBad = cfg.inverse ? pct > 60 : pct < 40;
          const barColor = isBad ? "#F5A623" : "#36C6A0";

          return (
            <div
              key={key}
              className="p-3.5 rounded-lg flex flex-col justify-between"
              style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#8DA5B5" }}>
                  <span>{cfg.label}</span>
                  <span className="font-mono text-[11px]">{item.unit}</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {typeof item.value === "number"
                    ? item.value > 10000
                      ? item.value.toLocaleString()
                      : item.value % 1 === 0
                      ? item.value
                      : item.value.toFixed(1)
                    : item.value}
                </div>
              </div>

              {/* Progress bar gauge */}
              <div className="mt-3">
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#06111C" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Congested Links Breakdown (if available) */}
      {congestedEdges.length > 0 && (
        <div
          className="p-4 rounded-lg space-y-3"
          style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-white flex items-center gap-1.5">
              <span>🚨</span> Congested Corridor Segments
            </h3>
            <span className="text-[11px] font-mono" style={{ color: "#F5A623" }}>
              {congestedEdges.length} links above capacity
            </span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {congestedEdges.slice(0, 10).map((edge) => (
              <div
                key={edge.edge_id}
                className="p-2.5 rounded text-xs font-mono flex items-center justify-between"
                style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}
              >
                <div>
                  <span className="text-white font-semibold">
                    Link {edge.edge_id}
                  </span>
                  <span className="block mt-0.5 text-[10px]" style={{ color: "#8DA5B5" }}>
                    Speed: {edge.average_speed_kmh?.toFixed(1)} km/h · Length:{" "}
                    {Math.round(edge.length_m)}m
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs" style={{ color: "#EF5350" }}>
                    V/C: {edge.volume_to_capacity_ratio?.toFixed(2)}
                  </span>
                  <span className="block mt-0.5 text-[10px]" style={{ color: "#8DA5B5" }}>
                    {edge.volume_veh} veh / {edge.capacity_veh_hr} cap
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumptions & Integrity Notice */}
      <div
        className="p-4 rounded-lg space-y-2.5"
        style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#00B8D9" }}>
          Model Calibration &amp; Scientific Assumptions
        </h3>
        <ul className="space-y-1 text-xs" style={{ color: "#8DA5B5" }}>
          {metrics.assumptions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span style={{ color: "#36C6A0" }}>✓</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>

        {metrics.warnings.length > 0 && (
          <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid #1B3445" }}>
            <p className="text-[11px] font-bold mb-1" style={{ color: "#F5A623" }}>Warnings:</p>
            <ul className="space-y-1 text-xs" style={{ color: "#F5A623" }}>
              {metrics.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
