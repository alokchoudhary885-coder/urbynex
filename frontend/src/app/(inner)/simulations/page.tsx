"use client";

/**
 * frontend/src/app/simulations/page.tsx
 *
 * M6.2 & M6.3: Production Simulation Monitor & Analytics
 * - Real-time job queue & worker status (Celery/BackgroundTask)
 * - Auto-refreshing list of recent simulation runs
 * - Detailed metric inspector with visual bar indicators & edge breakdown
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
  const styles: Record<RunStatus, string> = {
    completed: "bg-emerald-950 text-emerald-400 border-emerald-800",
    running: "bg-blue-950 text-blue-400 border-blue-800 animate-pulse",
    queued: "bg-amber-950 text-amber-400 border-amber-800",
    failed: "bg-red-950 text-red-400 border-red-800",
    cancelled: "bg-gray-800 text-gray-400 border-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${
        styles[status] ?? styles.queued
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "completed"
            ? "bg-emerald-400"
            : status === "running"
            ? "bg-blue-400"
            : status === "failed"
            ? "bg-red-400"
            : "bg-amber-400"
        }`}
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

  // Fetch runs list and worker status
  const refreshData = useCallback(async () => {
    try {
      const [runsRes, workerRes] = await Promise.allSettled([
        api.listSimulations(20),
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span>⚡</span> Simulation Monitor &amp; Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time execution queue, BPR/Webster telemetry, and link-level
            congestion analytics.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-2 ${
              autoRefresh
                ? "bg-emerald-950 border-emerald-800 text-emerald-400"
                : "bg-gray-900 border-gray-800 text-gray-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-emerald-400 animate-ping" : "bg-gray-600"
              }`}
            />
            {autoRefresh ? "Live polling ON" : "Polling paused"}
          </button>
          <button
            onClick={() => refreshData()}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg border border-gray-700 transition-colors"
          >
            ↻ Refresh Now
          </button>
        </div>
      </div>

      {/* Worker Queue Status Banner */}
      {worker && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div>
            <p className="text-xs text-gray-500">Dispatch Architecture</p>
            <p className="text-sm font-semibold text-white mt-1 capitalize font-mono">
              {worker.dispatch_mode.replace(/_/g, " ")}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Redis Queue Status</p>
            <p className="text-sm font-semibold mt-1 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  worker.redis_available ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span
                className={
                  worker.redis_available
                    ? "text-emerald-400 font-mono"
                    : "text-amber-400 font-mono"
                }
              >
                {worker.redis_available ? "Connected (Live)" : "Fallback Active"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Active Workers</p>
            <p className="text-sm font-semibold text-white mt-1 font-mono">
              {worker.celery_workers.length} nodes registered
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Task Broker</p>
            <p className="text-xs font-mono text-gray-400 mt-1 truncate">
              {worker.broker_url}
            </p>
          </div>
        </div>
      )}

      {/* Manual lookup input */}
      <form onSubmit={handleManualLookup} className="flex gap-3">
        <input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Lookup specific run ID: run_1234567890_abc123"
          className="flex-1 bg-gray-900 border border-gray-800 focus:border-emerald-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 font-mono outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!manualInput.trim()}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Inspect Run
        </button>
      </form>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Main Grid: Run Queue on Left, Details/Analytics on Right */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Recent Runs List (5 cols) */}
        <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Recent Simulation Runs</h2>
            <span className="text-xs text-gray-500 font-mono">
              {runs.length} runs recorded
            </span>
          </div>

          {loadingList ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Loading simulation runs…
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm space-y-2">
              <p>No simulations found yet.</p>
              <Link
                href="/scenarios"
                className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
              >
                Launch a scenario simulation →
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {runs.map((r) => {
                const isSelected = selectedRunId === r.run_id;
                return (
                  <button
                    key={r.run_id}
                    onClick={() => selectRun(r.run_id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-emerald-950/40 border-emerald-700 shadow-md shadow-emerald-950"
                        : "bg-gray-950/50 border-gray-800/80 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <StatusBadge status={r.status} />
                      <span className="text-xs font-mono text-gray-500">
                        {r.execution_time_seconds != null
                          ? `${r.execution_time_seconds.toFixed(2)}s`
                          : "in queue"}
                      </span>
                    </div>

                    <div className="font-mono text-xs text-white truncate">
                      {r.run_id}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2 font-mono">
                      <span>Seed: {r.seed}</span>
                      <span>{r.network_id.replace("_v1", "").toUpperCase()}</span>
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
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-400">Loading telemetry &amp; metrics…</p>
            </div>
          ) : metrics ? (
            <DetailedMetricsView metrics={metrics} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500 space-y-3">
              <div className="text-4xl">📊</div>
              <h3 className="text-base font-semibold text-gray-300">
                Select a simulation run
              </h3>
              <p className="text-sm max-w-md mx-auto">
                Choose any run from the queue on the left or enter a Run ID above
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
    <div className="space-y-6">
      {/* Run Header Banner */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <span className="text-xs font-mono uppercase text-gray-500">
              Run Telemetry Inspector
            </span>
            <h2 className="font-mono text-lg font-bold text-white mt-0.5">
              {metrics.run_id}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={metrics.status} />
            <span className="px-2.5 py-0.5 bg-yellow-950 text-yellow-400 border border-yellow-800 rounded-full text-xs font-mono font-semibold">
              {metrics.data_label}
            </span>
          </div>
        </div>

        {/* Metadata pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono border-t border-gray-800 pt-4">
          <div>
            <span className="text-gray-500 block">Engine:</span>
            <span className="text-gray-300">{metrics.engine}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Corridor:</span>
            <span className="text-gray-300">{metrics.network_id}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Execution:</span>
            <span className="text-gray-300">
              {metrics.execution_time_seconds != null
                ? `${metrics.execution_time_seconds.toFixed(2)}s`
                : "N/A"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Random Seed:</span>
            <span className="text-gray-300">{metrics.seed}</span>
          </div>
        </div>

        {/* Quick action button to compare */}
        <div className="mt-4 pt-3 border-t border-gray-800/80 flex justify-end">
          <Link
            href={`/compare`}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
          >
            ⚖ Compare this run against another run →
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid with Visual Gauges */}
      <div className="grid sm:grid-cols-2 gap-4">
        {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
          const item = metrics.metrics[key];
          if (!item) return null;

          const numVal = typeof item.value === "number" ? item.value : 0;
          const ratio = Math.min(1, Math.max(0, numVal / cfg.maxVal));
          const pct = Math.round(ratio * 100);

          // Color calculation (red = bad, green = good)
          const isBad = cfg.inverse ? pct > 60 : pct < 40;
          const barColor = isBad ? "bg-amber-500" : "bg-emerald-500";

          return (
            <div
              key={key}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>{cfg.label}</span>
                  <span className="font-mono">{item.unit}</span>
                </div>
                <div className="text-2xl font-bold font-mono text-white">
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
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Congested Links Breakdown (if available) */}
      {congestedEdges.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🚨</span> Congested Corridor Segments
            </h3>
            <span className="text-xs font-mono text-amber-400">
              {congestedEdges.length} links above capacity
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {congestedEdges.slice(0, 10).map((edge) => (
              <div
                key={edge.edge_id}
                className="bg-gray-950/70 border border-gray-800 rounded-lg p-3 text-xs font-mono flex items-center justify-between"
              >
                <div>
                  <span className="text-white font-semibold">
                    Link {edge.edge_id}
                  </span>
                  <span className="text-gray-500 block mt-0.5">
                    Speed: {edge.average_speed_kmh?.toFixed(1)} km/h · Length:{" "}
                    {Math.round(edge.length_m)}m
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-red-400 font-bold">
                    V/C: {edge.volume_to_capacity_ratio?.toFixed(2)}
                  </span>
                  <span className="text-gray-500 block mt-0.5">
                    {edge.volume_veh} veh / {edge.capacity_veh_hr} cap
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumptions & Integrity Notice */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Model Calibration &amp; Scientific Assumptions
        </h3>
        <ul className="space-y-1.5 text-xs text-gray-400">
          {metrics.assumptions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-emerald-500">✓</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>

        {metrics.warnings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-xs font-bold text-amber-400 mb-1">Warnings:</p>
            <ul className="space-y-1 text-xs text-amber-300">
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
