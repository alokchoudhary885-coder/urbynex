"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useScenarios } from "@/lib/hooks/useApi";
import { api, ApiClientError } from "@/lib/api/client";
import type { CreateScenarioRequest, ScenarioType, MonteCarloResponse } from "@/lib/api/types";

const SCENARIO_TYPES: { value: ScenarioType; label: string; desc: string }[] = [
  { value: "baseline", label: "Baseline Network", desc: "Standard traffic flow under normal capacity." },
  { value: "demand_change", label: "Demand Fluctuation", desc: "Model peak surge or reduced city traffic demand." },
  { value: "road_closure", label: "Road Closure Intervention", desc: "Completely close targeted road segments and evaluate rerouting." },
  { value: "incident", label: "Traffic Incident / Bottleneck", desc: "Simulate lane obstructions, speed drops, or roadwork." },
];

function ScenariosContent() {
  const searchParams = useSearchParams();
  const { data, loading, error, refetch } = useScenarios();

  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [closuresInput, setClosuresInput] = useState<string>("");
  const [closureReason, setClosureReason] = useState<string>("Planned Corridor Maintenance");
  const [incidentEdgesInput, setIncidentEdgesInput] = useState<string>("");
  const [capacityReduction, setCapacityReduction] = useState<number>(0.5);
  const [speedReduction, setSpeedReduction] = useState<number>(0.5);

  const [form, setForm] = useState<CreateScenarioRequest>({
    name: "",
    description: "",
    city_id: "jaipur",
    network_id: "jaipur_v1",
    scenario_type: "baseline",
    demand: { vehicle_count: 200, duration_seconds: 3600, seed: 42 },
  });

  // Pre-fill from URL parameters (e.g., coming from the Map Explorer)
  useEffect(() => {
    const netId = searchParams.get("network_id");
    const cityId = searchParams.get("city_id");
    const closures = searchParams.get("closures");

    if (netId || cityId || closures) {
      setForm((prev) => ({
        ...prev,
        network_id: netId || prev.network_id,
        city_id: cityId || prev.city_id,
        scenario_type: closures ? "road_closure" : prev.scenario_type,
        name: closures ? `Intervention on ${closures.split(",").length} Segment(s)` : prev.name,
      }));

      if (closures) {
        setClosuresInput(closures.split(",").join("\n"));
      }
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const payload: CreateScenarioRequest = {
        ...form,
      };

      // Add closures intervention if road_closure type
      if (form.scenario_type === "road_closure") {
        const edgeIds = closuresInput
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (edgeIds.length === 0) {
          throw new Error("Please specify at least one edge ID to close for a road closure scenario.");
        }
        payload.closures = {
          edge_ids: edgeIds,
          description: closureReason,
        };
      }

      // Add incident intervention if incident type
      if (form.scenario_type === "incident") {
        const edgeIds = incidentEdgesInput
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (edgeIds.length === 0) {
          throw new Error("Please specify at least one edge ID affected by the incident.");
        }
        payload.incidents = {
          edge_ids: edgeIds,
          capacity_reduction_factor: capacityReduction,
          speed_reduction_factor: speedReduction,
        };
      }

      const scenario = await api.createScenario(payload);
      setSubmitSuccess(`Created scenario: ${scenario.name} (${scenario.scenario_id})`);
      refetch();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof ApiClientError
          ? err.body.message
          : err instanceof Error
            ? err.message
            : String(err)
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Scenario Engineering</h1>
        <p className="text-gray-400 text-sm mt-1">
          Define reproducible traffic simulations, modify vehicle demand volume, or apply real network interventions such as road closures and incident bottlenecks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Scenario Config Form */}
        <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Configure New Scenario
            </h2>
            <span className="text-xs font-mono text-gray-500">Jaipur v1</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Scenario Title *</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                placeholder="e.g. MI Road Peak Closure Test"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Intervention Strategy *</span>
              <select
                value={form.scenario_type}
                onChange={(e) =>
                  setForm({ ...form, scenario_type: e.target.value as ScenarioType })
                }
                className="mt-1 block w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {SCENARIO_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                {SCENARIO_TYPES.find((t) => t.value === form.scenario_type)?.desc}
              </p>
            </label>

            {/* Road Closure Configuration Box */}
            {form.scenario_type === "road_closure" && (
              <div className="bg-red-950/30 border border-red-900/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-300">Target Road Segments (Closed)</span>
                  <Link href="/cities" className="text-[11px] text-emerald-400 hover:underline">
                    Pick on Map →
                  </Link>
                </div>
                <textarea
                  rows={3}
                  value={closuresInput}
                  onChange={(e) => setClosuresInput(e.target.value)}
                  placeholder="Paste edge IDs (one per line or comma-separated) e.g. 316420519_8637161036_0"
                  className="w-full bg-gray-950 border border-red-900/60 rounded-lg p-2.5 text-xs text-red-200 font-mono focus:outline-none focus:border-red-500"
                />
                <input
                  type="text"
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder="Closure justification / reason"
                  className="w-full bg-gray-950 border border-red-900/60 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
                />
              </div>
            )}

            {/* Incident Configuration Box */}
            {form.scenario_type === "incident" && (
              <div className="bg-amber-950/30 border border-amber-900/60 rounded-xl p-4 space-y-3">
                <span className="text-xs font-semibold text-amber-300 block">Incident Degradation Parameters</span>
                <textarea
                  rows={2}
                  value={incidentEdgesInput}
                  onChange={(e) => setIncidentEdgesInput(e.target.value)}
                  placeholder="Affected edge IDs (e.g. 316420519_8637161036_0)"
                  className="w-full bg-gray-950 border border-amber-900/60 rounded-lg p-2.5 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-500"
                />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label>
                    <span className="text-gray-400 block mb-1">Capacity Factor ({Math.round(capacityReduction * 100)}%)</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={capacityReduction}
                      onChange={(e) => setCapacityReduction(+e.target.value)}
                      className="w-full accent-amber-500"
                    />
                  </label>
                  <label>
                    <span className="text-gray-400 block mb-1">Speed Factor ({Math.round(speedReduction * 100)}%)</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={speedReduction}
                      onChange={(e) => setSpeedReduction(+e.target.value)}
                      className="w-full accent-amber-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Demand Settings */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Vehicle Trips</span>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={form.demand.vehicle_count}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      demand: { ...form.demand, vehicle_count: +e.target.value },
                    })
                  }
                  className="mt-1 block w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Duration (sec)</span>
                <input
                  type="number"
                  min={300}
                  max={86400}
                  step={300}
                  value={form.demand.duration_seconds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      demand: { ...form.demand, duration_seconds: +e.target.value },
                    })
                  }
                  className="mt-1 block w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">RNG Seed (Deterministic Simulation)</span>
              <input
                type="number"
                value={form.demand.seed}
                onChange={(e) =>
                  setForm({ ...form, demand: { ...form.demand, seed: +e.target.value } })
                }
                className="mt-1 block w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </label>

            {submitError && (
              <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-3 text-xs leading-relaxed">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-xl p-3 text-xs">
                {submitSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-emerald-950"
            >
              {creating ? "Persisting Scenario…" : "Save Scenario Definition"}
            </button>
          </form>
        </div>

        {/* Existing Scenarios List & Run Runner */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Saved Scenarios</span>
              <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-xs font-mono">
                {data?.total ?? 0}
              </span>
            </h2>
            <button
              onClick={() => refetch()}
              className="text-xs text-gray-400 hover:text-emerald-400 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center p-12 text-gray-500 text-xs">
              Loading scenarios from database...
            </div>
          )}

          {error && (
            <div className="bg-red-950/60 border border-red-800 text-red-300 p-4 rounded-xl text-xs">
              Error fetching scenarios: {error}
            </div>
          )}

          <div className="space-y-4">
            {data?.scenarios.map((s) => (
              <ScenarioCard key={s.scenario_id} scenario={s} />
            ))}

            {data?.total === 0 && !loading && (
              <div className="bg-gray-900 border border-dashed border-gray-800 rounded-2xl p-8 text-center text-gray-500 text-sm">
                No scenarios registered yet. Configure your first baseline or intervention scenario on the left.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
}: {
  scenario: {
    scenario_id: string;
    name: string;
    scenario_type: string;
    network_id: string;
    demand: { vehicle_count: number; duration_seconds: number; seed?: number };
    created_at: string;
  };
}) {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ run_id: string; status: string } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runAsync, setRunAsync] = useState(false);

  const [mcRunning, setMcRunning] = useState(false);
  const [mcResult, setMcResult] = useState<MonteCarloResponse | null>(null);
  const [mcError, setMcError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const result = await api.runSimulation({
        scenario_id: scenario.scenario_id,
        run_async: runAsync,
      });
      setRunResult({ run_id: result.run_id, status: result.status });
    } catch (err: unknown) {
      setRunError(err instanceof ApiClientError ? err.body.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleMonteCarloRun() {
    setMcRunning(true);
    setMcError(null);
    try {
      const res = await api.runMonteCarlo({
        scenario_id: scenario.scenario_id,
        seeds: [42, 101, 202, 303, 404],
      });
      setMcResult(res);
    } catch (err: unknown) {
      setMcError(err instanceof ApiClientError ? err.body.message : String(err));
    } finally {
      setMcRunning(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-white text-base">{scenario.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[11px] text-gray-500">{scenario.scenario_id}</span>
            <span className="text-gray-700">·</span>
            <span className="font-mono text-[11px] text-emerald-400">{scenario.network_id}</span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 text-xs font-mono uppercase">
          {scenario.scenario_type}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-gray-950/60 p-3 rounded-xl border border-gray-800/80 text-xs">
        <div>
          <span className="text-[10px] text-gray-500 uppercase block">Vehicles</span>
          <span className="font-mono font-semibold text-gray-200">
            {scenario.demand.vehicle_count.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase block">Duration</span>
          <span className="font-mono font-semibold text-gray-200">
            {scenario.demand.duration_seconds}s
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase block">Seed</span>
          <span className="font-mono font-semibold text-gray-200">
            {scenario.demand.seed ?? 42}
          </span>
        </div>
      </div>

      {runResult && (
        <div className="bg-emerald-950/70 border border-emerald-800/80 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-emerald-300">
            <span>✓ Simulation {runResult.status}:</span>
            <span className="font-mono font-bold text-emerald-200">{runResult.run_id}</span>
          </div>
          <div className="flex items-center gap-3 pt-1 border-t border-emerald-900/60 text-[11px]">
            <Link
              href={`/simulations`}
              className="text-emerald-400 underline font-semibold hover:text-emerald-300"
            >
              Inspect Metrics →
            </Link>
            <Link
              href={`/compare`}
              className="text-emerald-400 underline font-semibold hover:text-emerald-300"
            >
              Compare with Baseline →
            </Link>
          </div>
        </div>
      )}

      {runError && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-3 text-xs">
          {runError}
        </div>
      )}

      {mcResult && (
        <div className="bg-indigo-950/40 border border-indigo-800/80 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between text-indigo-300">
            <span className="font-semibold flex items-center gap-1.5">
              <span>🎲</span> Monte Carlo Batch Simulation (95% CI)
            </span>
            <span className="font-mono text-[11px] text-indigo-400">
              {mcResult.seed_count} seeds · {mcResult.total_execution_time_seconds.toFixed(2)}s
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(mcResult.metrics_summary).map(([metricKey, m]) => (
              <div key={metricKey} className="bg-gray-950/80 p-2.5 rounded-lg border border-indigo-900/40">
                <span className="text-[10px] text-gray-400 block truncate">{m.metric_name}</span>
                <div className="text-white font-mono font-bold text-xs mt-0.5">
                  {m.mean.toFixed(1)} <span className="text-[10px] text-gray-500 font-normal">{m.unit}</span>
                </div>
                <div className="text-[10px] text-indigo-300/90 font-mono mt-1">
                  ±{((m.ci_95_upper - m.ci_95_lower) / 2).toFixed(1)} (95% CI)
                </div>
                <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                  [{m.ci_95_lower.toFixed(1)} - {m.ci_95_upper.toFixed(1)}]
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-400 flex items-center justify-between border-t border-indigo-950 pt-2">
            <span>RNG Seeds: [{mcResult.seeds.join(", ")}]</span>
            <span className="font-mono">{mcResult.individual_run_ids.length} batch runs recorded</span>
          </div>
        </div>
      )}

      {mcError && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-3 text-xs">
          Monte Carlo Error: {mcError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={runAsync}
            onChange={(e) => setRunAsync(e.target.checked)}
            className="rounded bg-gray-800 border-gray-700 text-emerald-500 focus:ring-0"
          />
          <span>Background Execution (Celery/Async queue)</span>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMonteCarloRun}
            disabled={mcRunning || running}
            className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-all shadow-md shadow-indigo-950 flex items-center justify-center gap-1.5"
            title="Execute 5 stochastic seed runs and compute 95% Confidence Intervals"
          >
            {mcRunning ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Simulating 5 Seeds...</span>
              </>
            ) : (
              <>
                <span>🎲 5-Seed Monte Carlo</span>
              </>
            )}
          </button>

          <button
            onClick={handleRun}
            disabled={running || mcRunning}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
          >
            {running ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <span>▶ Execute Single</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScenariosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 text-sm">Loading Scenario Engineering Studio...</div>}>
      <ScenariosContent />
    </Suspense>
  );
}
