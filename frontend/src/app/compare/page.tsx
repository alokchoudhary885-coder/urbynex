"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import type { ComparisonResult } from "@/lib/api/types";

export default function ComparePage() {
  const [baseId, setBaseId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Compare Runs</h1>
        <p className="text-gray-400 text-sm">
          Enter two completed simulation run IDs to compare their metrics side-by-side.
        </p>
      </div>

      <form onSubmit={handleCompare} className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Baseline Run ID</span>
          <input
            required
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
            placeholder="run_baseline_..."
            className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-600"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Target Run ID</span>
          <input
            required
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="run_target_..."
            className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-600"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading || !baseId.trim() || !targetId.trim()}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {result && <ComparisonPanel result={result} />}
    </div>
  );
}

function ComparisonPanel({ result }: { result: ComparisonResult }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-gray-200 text-sm font-medium">{result.summary}</p>
        {result.warnings.map((w, i) => (
          <p key={i} className="text-yellow-400 text-xs mt-2">{w}</p>
        ))}
      </div>

      {/* Metric diffs table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-px bg-gray-800 text-xs font-medium uppercase tracking-wider text-gray-500 px-5 py-3">
          <span className="col-span-2">Metric</span>
          <span className="text-right">Baseline</span>
          <span className="text-right">Target</span>
          <span className="text-right">Change</span>
        </div>
        {result.metric_diffs.map((diff) => (
          <div
            key={diff.metric_name}
            className="grid grid-cols-5 gap-px border-t border-gray-800 px-5 py-3 items-center"
          >
            <div className="col-span-2">
              <p className="text-sm text-gray-200">
                {diff.metric_name.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-gray-600">{diff.unit}</p>
            </div>
            <p className="text-right text-sm text-gray-300 font-mono">
              {diff.baseline_value.toFixed(1)}
            </p>
            <p className="text-right text-sm text-gray-300 font-mono">
              {diff.target_value.toFixed(1)}
            </p>
            <p
              className={`text-right text-sm font-semibold font-mono ${
                diff.improved ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {diff.percent_change > 0 ? "+" : ""}
              {diff.percent_change.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
