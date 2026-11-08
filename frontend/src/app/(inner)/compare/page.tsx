"use client";

/**
 * frontend/src/app/(inner)/compare/page.tsx
 *
 * Command Center Scenario Comparison Studio
 * - Side-by-side run picker from recent runs or manual IDs
 * - Visual delta metrics with improvement direction indicators
 * - Scenario intervention diff & warning indicators
 * - Direct query parameter loading (?baseline=...&target=...)
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api/client";
import type { ComparisonResult, SimulationRunStatus } from "@/lib/api/types";

export default function ComparePage() {
  const [baseId, setBaseId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [recentRuns, setRecentRuns] = useState<SimulationRunStatus[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch recent runs for quick selection
  useEffect(() => {
    api
      .listSimulations(20)
      .then((res) => {
        setRecentRuns(res.runs);
        if (res.runs.length >= 2) {
          // Default baseline to second run and target to most recent run
          setBaseId((prev) => prev || res.runs[1].run_id);
          setTargetId((prev) => prev || res.runs[0].run_id);
        }
      })
      .catch((e) => console.error("Could not fetch runs for picker:", e));
  }, []);

  async function handleCompare(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!baseId.trim() || !targetId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.compareRuns({
        baseline_run_id: baseId.trim(),
        target_run_id: targetId.trim(),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function swapRuns() {
    const temp = baseId;
    setBaseId(targetId);
    setTargetId(temp);
  }

  return (
    <div
      className="min-h-screen px-6 py-6 space-y-6"
      style={{ background: "#06111C", color: "#EAF3F8" }}
    >
      {/* Header */}
      <div className="pb-4" style={{ borderBottom: "1px solid #1B3445" }}>
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-mono mb-2" style={{ background: "rgba(0,184,217,0.12)", color: "#00B8D9", border: "1px solid rgba(0,184,217,0.3)" }}>
          URBAN SCENARIO INTELLIGENCE · IMPACT DELTAS
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span style={{ color: "#00B8D9" }}>⚖️</span> Scenario Comparison Studio
        </h1>
        <p className="text-xs mt-0.5 max-w-2xl" style={{ color: "#8DA5B5" }}>
          Compare two simulation runs side-by-side to evaluate the traffic
          impact of road closures, signal timings, incidents, or peak demand
          surges across urban networks.
        </p>
      </div>

      {/* Comparison Selector Form */}
      <div
        className="p-5 rounded-lg space-y-5"
        style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
      >
        <form onSubmit={handleCompare} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5 relative">
            {/* Baseline Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white">
                  Baseline Run (Control)
                </label>
                <span className="text-[10px] font-mono" style={{ color: "#8DA5B5" }}>Reference Network</span>
              </div>

              {recentRuns.length > 0 && (
                <select
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                  className="w-full rounded px-3 py-1.5 text-xs font-mono outline-none mb-1.5"
                  style={{
                    background: "#06111C",
                    border: "1px solid #1B3445",
                    color: "#EAF3F8",
                  }}
                >
                  <option value="">-- Select from recent runs --</option>
                  {recentRuns.map((r) => (
                    <option key={r.run_id} value={r.run_id} style={{ background: "#0B1D2B" }}>
                      {r.run_id} ({r.network_id.replace("_v1", "").toUpperCase()} - seed {r.seed})
                    </option>
                  ))}
                </select>
              )}

              <input
                required
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                placeholder="Or paste baseline run ID..."
                className="w-full rounded px-3 py-2 text-xs font-mono outline-none"
                style={{
                  background: "#06111C",
                  border: "1px solid #1B3445",
                  color: "#EAF3F8",
                }}
              />
            </div>

            {/* Target Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#00B8D9" }}>
                  Target Run (Intervention)
                </label>
                <span className="text-[10px] font-mono" style={{ color: "#8DA5B5" }}>Simulated Policy</span>
              </div>

              {recentRuns.length > 0 && (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded px-3 py-1.5 text-xs font-mono outline-none mb-1.5"
                  style={{
                    background: "#06111C",
                    border: "1px solid #1B3445",
                    color: "#EAF3F8",
                  }}
                >
                  <option value="">-- Select from recent runs --</option>
                  {recentRuns.map((r) => (
                    <option key={r.run_id} value={r.run_id} style={{ background: "#0B1D2B" }}>
                      {r.run_id} ({r.network_id.replace("_v1", "").toUpperCase()} - seed {r.seed})
                    </option>
                  ))}
                </select>
              )}

              <input
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Or paste target run ID..."
                className="w-full rounded px-3 py-2 text-xs font-mono outline-none"
                style={{
                  background: "#06111C",
                  border: "1px solid #1B3445",
                  color: "#EAF3F8",
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid #1B3445" }}>
            <button
              type="button"
              onClick={swapRuns}
              className="text-xs font-mono transition-colors flex items-center gap-1.5"
              style={{ color: "#8DA5B5" }}
            >
              ⇄ Swap Baseline &amp; Target
            </button>

            <button
              type="submit"
              disabled={loading || !baseId.trim() || !targetId.trim()}
              className="px-5 py-2 text-xs font-mono font-medium rounded transition-colors disabled:opacity-50"
              style={{
                background: "#00B8D9",
                color: "#06111C",
              }}
            >
              {loading ? "Computing Deltas…" : "Compare Runs Side-by-Side"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div
          className="p-3 rounded text-xs font-mono"
          style={{ background: "rgba(239,83,80,0.12)", border: "1px solid #EF5350", color: "#EF5350" }}
        >
          ⚠ {error}
        </div>
      )}

      {result && <ComparisonResultDisplay result={result} />}
    </div>
  );
}

// ── Comparison Results Display ───────────────────────────────────────────────

function ComparisonResultDisplay({ result }: { result: ComparisonResult }) {
  const improvedCount = result.metric_diffs.filter((m) => m.improved).length;
  const totalCount = result.metric_diffs.length;

  return (
    <div className="space-y-5">
      {/* Executive Summary Card */}
      <div
        className="p-5 rounded-lg space-y-3"
        style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base" style={{ color: "#00B8D9" }}>📊</span>
            <h2 className="text-sm font-bold text-white">
              Comparative Impact Analysis
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold"
              style={{
                background: improvedCount >= totalCount / 2 ? "rgba(54,198,160,0.12)" : "rgba(245,166,35,0.12)",
                color: improvedCount >= totalCount / 2 ? "#36C6A0" : "#F5A623",
                border: `1px solid ${improvedCount >= totalCount / 2 ? "rgba(54,198,160,0.3)" : "rgba(245,166,35,0.3)"}`,
              }}
            >
              {improvedCount}/{totalCount} Metrics Improved
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
              style={{ background: "rgba(0,184,217,0.12)", color: "#00B8D9", border: "1px solid rgba(0,184,217,0.3)" }}
            >
              SIMULATED DELTAS
            </span>
          </div>
        </div>

        <p
          className="text-xs leading-relaxed p-3.5 rounded font-mono"
          style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445", color: "#EAF3F8" }}
        >
          {result.summary}
        </p>

        {result.warnings.length > 0 && (
          <div className="space-y-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs flex items-center gap-1.5" style={{ color: "#F5A623" }}>
                <span>⚠</span> {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Metric Diffs Visual Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">Metric-by-Metric Breakdown</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {result.metric_diffs.map((diff) => {
            const isPositive = diff.percent_change >= 0;

            return (
              <div
                key={diff.metric_name}
                className="p-3.5 rounded-lg flex flex-col justify-between"
                style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white capitalize">
                      {diff.metric_name.replace(/_/g, " ")}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                      style={{
                        background: diff.improved ? "rgba(54,198,160,0.12)" : "rgba(239,83,80,0.12)",
                        color: diff.improved ? "#36C6A0" : "#EF5350",
                        border: `1px solid ${diff.improved ? "rgba(54,198,160,0.3)" : "rgba(239,83,80,0.3)"}`,
                      }}
                    >
                      {diff.improved ? "✓ Improved" : "✗ Degraded"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2.5">
                    <div className="p-2 rounded" style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}>
                      <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>
                        BASELINE
                      </span>
                      <span className="text-white text-xs font-bold">
                        {diff.baseline_value.toFixed(1)}
                      </span>
                      <span className="ml-1 text-[10px]" style={{ color: "#8DA5B5" }}>{diff.unit}</span>
                    </div>

                    <div className="p-2 rounded" style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}>
                      <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>
                        TARGET
                      </span>
                      <span className="text-white text-xs font-bold">
                        {diff.target_value.toFixed(1)}
                      </span>
                      <span className="ml-1 text-[10px]" style={{ color: "#8DA5B5" }}>{diff.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Percentage delta bar */}
                <div className="pt-2 flex items-center justify-between text-xs font-mono" style={{ borderTop: "1px solid #1B3445" }}>
                  <span style={{ color: "#8DA5B5" }}>
                    Net Delta: {diff.absolute_change > 0 ? "+" : ""}
                    {diff.absolute_change.toFixed(1)} {diff.unit}
                  </span>
                  <span
                    className="font-bold text-xs"
                    style={{ color: diff.improved ? "#36C6A0" : "#EF5350" }}
                  >
                    {isPositive ? "+" : ""}
                    {diff.percent_change.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Steps CTA */}
      <div
        className="p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
      >
        <div>
          <h4 className="text-xs font-semibold text-white">
            Have questions about this comparison?
          </h4>
          <p className="text-[11px] mt-0.5" style={{ color: "#8DA5B5" }}>
            Ask AI Copilot to explain why travel times and corridor throughput changed between these two runs.
          </p>
        </div>
        <Link
          href="/ai"
          className="px-4 py-2 text-xs font-mono font-medium rounded transition-colors shrink-0"
          style={{ background: "#00B8D9", color: "#06111C" }}
        >
          🤖 Ask Copilot About This Delta →
        </Link>
      </div>
    </div>
  );
}
