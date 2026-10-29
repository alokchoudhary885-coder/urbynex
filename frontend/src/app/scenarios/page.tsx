"use client";

import { useState } from "react";
import { useScenarios } from "@/lib/hooks/useApi";
import { api, ApiClientError } from "@/lib/api/client";
import type { CreateScenarioRequest, ScenarioType } from "@/lib/api/types";

const SCENARIO_TYPES: { value: ScenarioType; label: string; desc: string }[] = [
  { value: "baseline", label: "Baseline", desc: "Normal traffic flow — no interventions." },
  { value: "demand_change", label: "Demand Change", desc: "Simulate higher or lower vehicle volumes." },
  { value: "road_closure", label: "Road Closure", desc: "Close specific road segments." },
  { value: "incident", label: "Incident", desc: "Capacity or speed reduction on segments." },
];

export default function ScenariosPage() {
  const { data, loading, error, refetch } = useScenarios();
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<CreateScenarioRequest>({
    name: "",
    description: "",
    city_id: "jaipur",
    network_id: "jaipur_v1",
    scenario_type: "baseline",
    demand: { vehicle_count: 200, duration_seconds: 3600, seed: 42 },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const scenario = await api.createScenario(form);
      setSubmitSuccess(`Created scenario: ${scenario.scenario_id}`);
      refetch();
    } catch (err) {
      setSubmitError(
        err instanceof ApiClientError ? err.body.message : String(err),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-5 gap-8">
      {/* Create Scenario Form */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-xl font-bold text-white">New Scenario</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              placeholder="Morning Peak Baseline"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Type *</span>
            <select
              value={form.scenario_type}
              onChange={(e) =>
                setForm({ ...form, scenario_type: e.target.value as ScenarioType })
              }
              className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
            >
              {SCENARIO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {SCENARIO_TYPES.find((t) => t.value === form.scenario_type)?.desc}
            </p>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Vehicles</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={form.demand.vehicle_count}
                onChange={(e) =>
                  setForm({
                    ...form,
                    demand: { ...form.demand, vehicle_count: +e.target.value },
                  })
                }
                className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Duration (s)</span>
              <input
                type="number"
                min={60}
                max={86400}
                value={form.demand.duration_seconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    demand: { ...form.demand, duration_seconds: +e.target.value },
                  })
                }
                className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Seed (reproducibility)</span>
            <input
              type="number"
              value={form.demand.seed}
              onChange={(e) =>
                setForm({ ...form, demand: { ...form.demand, seed: +e.target.value } })
              }
              className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
            />
          </label>

          {submitError && (
            <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-3 py-2 text-sm">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-lg px-3 py-2 text-sm">
              {submitSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {creating ? "Creating…" : "Create Scenario"}
          </button>
        </form>
      </div>

      {/* Scenario List */}
      <div className="lg:col-span-3 space-y-4">
        <h2 className="text-xl font-bold text-white">
          Saved Scenarios{" "}
          <span className="text-gray-500 text-base font-normal">
            ({data?.total ?? 0})
          </span>
        </h2>

        {loading && (
          <div className="text-gray-500 text-sm">Loading…</div>
        )}
        {error && (
          <div className="text-red-400 text-sm">Error: {error}</div>
        )}

        {data?.scenarios.map((s) => (
          <ScenarioCard key={s.scenario_id} scenario={s} />
        ))}
        {data?.total === 0 && !loading && (
          <p className="text-gray-600 text-sm">No scenarios yet. Create one on the left.</p>
        )}
      </div>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: { scenario_id: string; name: string; scenario_type: string; demand: { vehicle_count: number; duration_seconds: number; seed?: number }; created_at: string } }) {
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    try {
      const result = await api.runSimulation({
        scenario_id: scenario.scenario_id,
        run_async: false,
      });
      setRunId(result.run_id);
    } catch (err) {
      setRunError(err instanceof ApiClientError ? err.body.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="font-semibold text-white">{scenario.name}</h3>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{scenario.scenario_id}</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-xs">
          {scenario.scenario_type}
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-4 space-y-0.5">
        <p>{scenario.demand.vehicle_count} vehicles · {scenario.demand.duration_seconds}s · seed={scenario.demand.seed ?? 42}</p>
        <p>Created: {new Date(scenario.created_at).toLocaleString()}</p>
      </div>

      {runId && (
        <div className="mb-3 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-lg px-3 py-2 text-xs font-mono">
          ✓ run_id: {runId}
        </div>
      )}
      {runError && (
        <div className="mb-3 bg-red-950 border border-red-800 text-red-300 rounded-lg px-3 py-2 text-xs">
          {runError}
        </div>
      )}

      <button
        onClick={handleRun}
        disabled={running}
        className="px-4 py-2 text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-colors"
      >
        {running ? "Running…" : "▶ Run Simulation"}
      </button>
    </div>
  );
}
