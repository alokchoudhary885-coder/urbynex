"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import type { SimulationMetrics } from "@/lib/api/types";

const KEY_METRICS = [
  "completed_trips",
  "avg_travel_time_s",
  "avg_waiting_time_s",
  "avg_distance_m",
  "throughput_veh_per_hr",
  "routing_failures",
];

export default function SimulationsPage() {
  const [runId, setRunId] = useState("");
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!runId.trim()) return;
    setLoading(true);
    setError(null);
    setMetrics(null);
    try {
      const result = await api.getSimulationMetrics(runId.trim());
      setMetrics(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Simulations</h1>
        <p className="text-gray-400 text-sm">
          Look up a simulation run by its ID to view metrics and congestion data.
          Run IDs are returned by the scenario page when you execute a simulation.
        </p>
      </div>

      {/* Run ID Lookup */}
      <form onSubmit={handleFetch} className="flex gap-3">
        <input
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          placeholder="run_1234567890_abc123"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 font-mono"
        />
        <button
          type="submit"
          disabled={loading || !runId.trim()}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          {loading ? "Loading…" : "Fetch"}
        </button>
      </form>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {metrics && <MetricsPanel metrics={metrics} />}
    </div>
  );
}

function MetricsPanel({ metrics }: { metrics: SimulationMetrics }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="font-mono text-xs text-gray-500">run_id</p>
            <p className="font-mono text-sm text-white">{metrics.run_id}</p>
          </div>
          <div className="flex gap-2">
            <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-400 text-xs border border-emerald-800">
              {metrics.status}
            </span>
            <span className="px-2 py-1 rounded bg-yellow-950 text-yellow-400 text-xs border border-yellow-800">
              {metrics.data_label}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>Engine: <span className="text-gray-300">{metrics.engine}</span></p>
          <p>Network: <span className="text-gray-300">{metrics.network_id}</span></p>
          <p>Execution time: <span className="text-gray-300">{metrics.execution_time_seconds?.toFixed(2)}s</span></p>
          {metrics.created_at && (
            <p>Completed: <span className="text-gray-300">{new Date(metrics.created_at).toLocaleString()}</span></p>
          )}
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {KEY_METRICS.map((key) => {
          const m = metrics.metrics[key];
          if (!m) return null;
          return (
            <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1 leading-tight">{m.description}</p>
              <p className="text-2xl font-bold text-white">
                {typeof m.value === "number"
                  ? m.value > 10000
                    ? m.value.toLocaleString()
                    : m.value % 1 === 0
                      ? m.value
                      : m.value.toFixed(1)
                  : m.value}
              </p>
              <p className="text-xs text-gray-600 mt-1">{m.unit}</p>
            </div>
          );
        })}
      </div>

      {/* Assumptions */}
      {metrics.assumptions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Model Assumptions</h3>
          <ul className="space-y-1">
            {metrics.assumptions.map((a, i) => (
              <li key={i} className="text-xs text-gray-500 flex gap-2">
                <span className="text-gray-700">•</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {metrics.warnings.length > 0 && (
        <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-yellow-300 mb-2">Warnings</h3>
          <ul className="space-y-1">
            {metrics.warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-400">{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
