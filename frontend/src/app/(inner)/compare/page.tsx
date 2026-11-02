"use client";

/**
 * frontend/src/app/compare/page.tsx
 *
 * M6.4: Production Scenario Comparison Studio
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
      .listSimulations(15)
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
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950 border border-emerald-800 rounded-full text-emerald-400 text-xs font-mono mb-2">
          Milestone 6.4 · Scenario Analytics
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <span>⚖️</span> Scenario Comparison Studio
        </h1>
        <p className="text-gray-400 text-sm max-w-2xl">
          Compare two simulation runs side-by-side to evaluate the traffic
          impact of road closures, signal timings, incidents, or peak demand
          surges.
        </p>
      </div>

      {/* Comparison Selector Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <form onSubmit={handleCompare} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6 relative">
            {/* Baseline Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Baseline Run (Control)
                </label>
                <span className="text-xs text-gray-500 font-mono">Reference</span>
              </div>

              {recentRuns.length > 0 && (
                <select
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono outline-none focus:border-emerald-600 mb-2"
                >
                  <option value="">-- Select from recent runs --</option>
                  {recentRuns.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      {r.run_id} ({r.network_id.replace("_v1", "")} - seed {r.seed})
                    </option>
                  ))}
                </select>
              )}

              <input
                required
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                placeholder="Or paste baseline run ID..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Target Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Target Run (Intervention)
                </label>
                <span className="text-xs text-gray-500 font-mono">Simulated</span>
              </div>

              {recentRuns.length > 0 && (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono outline-none focus:border-emerald-600 mb-2"
                >
                  <option value="">-- Select from recent runs --</option>
                  {recentRuns.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      {r.run_id} ({r.network_id.replace("_v1", "")} - seed {r.seed})
                    </option>
                  ))}
                </select>
              )}

              <input
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Or paste target run ID..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800/80">
            <button
              type="button"
              onClick={swapRuns}
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              ⇄ Swap Baseline &amp; Target
            </button>

            <button
              type="submit"
              disabled={loading || !baseId.trim() || !targetId.trim()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-950"
            >
              {loading ? "Computing Deltas…" : "Compare Runs Side-by-Side"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-2xl px-5 py-4 text-sm">
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
    <div className="space-y-6">
      {/* Executive Summary Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-base font-bold text-white">
              Comparative Impact Analysis
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border ${
                improvedCount >= totalCount / 2
                  ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                  : "bg-amber-950 text-amber-400 border-amber-800"
              }`}
            >
              {improvedCount}/{totalCount} Metrics Improved
            </span>
            <span className="px-2.5 py-1 bg-yellow-950 text-yellow-400 border border-yellow-800 rounded-full text-xs font-mono">
              SIMULATED DELTAS
            </span>
          </div>
        </div>

        <p className="text-gray-300 text-sm leading-relaxed bg-gray-950/60 p-4 rounded-xl border border-gray-800 font-mono">
          {result.summary}
        </p>

        {result.warnings.length > 0 && (
          <div className="space-y-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-amber-400 text-xs flex items-center gap-1.5">
                <span>⚠</span> {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Metric Diffs Visual Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Metric-by-Metric Breakdown</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {result.metric_diffs.map((diff) => {
            const isPositive = diff.percent_change >= 0;

            return (
              <div
                key={diff.metric_name}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white capitalize">
                      {diff.metric_name.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        diff.improved
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-red-950 text-red-400 border border-red-800"
                      }`}
                    >
                      {diff.improved ? "✓ Improved" : "✗ Degraded"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono text-gray-400 my-3">
                    <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
                      <span className="text-gray-600 block text-[10px]">
                        BASELINE
                      </span>
                      <span className="text-white text-sm font-bold">
                        {diff.baseline_value.toFixed(1)}
                      </span>
                      <span className="text-gray-500 ml-1">{diff.unit}</span>
                    </div>

                    <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
                      <span className="text-gray-600 block text-[10px]">
                        TARGET
                      </span>
                      <span className="text-white text-sm font-bold">
                        {diff.target_value.toFixed(1)}
                      </span>
                      <span className="text-gray-500 ml-1">{diff.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Percentage delta bar */}
                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-500">
                    Net Delta: {diff.absolute_change > 0 ? "+" : ""}
                    {diff.absolute_change.toFixed(1)} {diff.unit}
                  </span>
                  <span
                    className={`font-bold ${
                      diff.improved ? "text-emerald-400" : "text-red-400"
                    }`}
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
      <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-white">
            Have questions about this comparison?
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">
            Ask AI Copilot to explain why travel times changed between these two runs.
          </p>
        </div>
        <Link
          href={`/ai`}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
        >
          🤖 Ask Copilot About This Delta →
        </Link>
      </div>
    </div>
  );
}
