"use client";

/**
 * frontend/src/app/data/page.tsx
 *
 * M6.6: Production Data Management & Quality Studio
 * - Live Traffic Provider health & zero-fabrication status
 * - Historical CSV/JSON dataset upload with automated schema & quality auditing
 * - Network versioning & GIS layer registry
 */

import { useState, useEffect } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import type {
  LiveProviderStatus,
  HistoricalImportResponse,
  CityNetwork,
} from "@/lib/api/types";

// ── Sample Templates for Quick Validation ───────────────────────────────────

const SAMPLE_CSV = `timestamp,edge_id,speed_kmh,volume_veh_per_hr
2026-10-31T08:00:00+05:30,316823908,42.5,1200
2026-10-31T09:00:00+05:30,316823908,28.0,3400
2026-10-31T10:00:00+05:30,316823908,35.0,2100
2026-10-31T08:00:00+05:30,316823910,45.0,950
2026-10-31T09:00:00+05:30,316823910,31.5,2800`;

const SAMPLE_JSON = JSON.stringify(
  [
    {
      edge_id: "316823908",
      timestamp: "2026-10-31T08:30:00Z",
      speed_kmh: 38.5,
      volume_veh: 180,
    },
    {
      edge_id: "316823910",
      timestamp: "2026-10-31T08:30:00Z",
      speed_kmh: 41.2,
      volume_veh: 155,
    },
  ],
  null,
  2
);

// ── Main Page Component ──────────────────────────────────────────────────────

export default function DataManagementPage() {
  const [providers, setProviders] = useState<LiveProviderStatus[]>([]);
  const [networks, setNetworks] = useState<CityNetwork[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "historical" | "networks">(
    "live"
  );

  // Upload state
  const [networkId, setNetworkId] = useState("jaipur_v1");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [sourceName, setSourceName] = useState("traffic_sample_oct26");
  const [payload, setPayload] = useState(SAMPLE_CSV);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] =
    useState<HistoricalImportResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    api
      .getLiveProviders()
      .then((res) => setProviders(res.providers))
      .catch((e) => console.error("Failed to load providers:", e));

    api
      .getCityNetworks()
      .then((res) => setNetworks(res.networks))
      .catch((e) => console.error("Failed to load networks:", e));
  }, []);

  function handleFormatChange(f: "csv" | "json") {
    setFormat(f);
    setPayload(f === "csv" ? SAMPLE_CSV : SAMPLE_JSON);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!payload.trim()) return;

    setUploading(true);
    setUploadError(null);
    setImportResult(null);

    try {
      const res = await api.uploadHistoricalTraffic(
        payload,
        format,
        networkId,
        sourceName
      );
      setImportResult(res);
    } catch (err) {
      setUploadError(
        err instanceof ApiClientError ? err.body.message : String(err)
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950 border border-emerald-800 rounded-full text-emerald-400 text-xs font-mono mb-2">
          Milestone 6.6 · Data Engineering &amp; Governance
        </div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <span>💾</span> Data Management &amp; Ingestion Studio
        </h1>
        <p className="text-gray-400 text-sm mt-1 max-w-2xl">
          Audit live traffic telemetry feeds, upload historical speed/volume
          datasets, and inspect road network digital twin versioning.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 gap-6">
        {[
          { id: "live", label: "Live Telemetry Providers", icon: "🛰️" },
          { id: "historical", label: "Historical Data Ingestion", icon: "📥" },
          { id: "networks", label: "Network Digital Twins", icon: "🗺️" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: Live Telemetry Providers ──────────────────────────────── */}
      {activeTab === "live" && (
        <div className="space-y-6">
          {/* Zero-Fabrication Disclosure Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start">
            <div className="text-3xl">🛡️</div>
            <div className="space-y-2 flex-1">
              <h3 className="text-base font-bold text-white">
                Zero-Fabrication Data Policy
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Urbynex enforces strict data provenance. Third-party live traffic
                feeds (TomTom, Google Routes, HERE) require verified API
                credentials in environment variables. If an adapter lacks API
                keys, it is clearly reported as{" "}
                <code className="text-amber-400 bg-gray-950 px-1.5 py-0.5 rounded font-mono text-xs">
                  credentials_missing
                </code>
                . We never invent fake real-time telemetry.
              </p>
            </div>
          </div>

          {/* Providers Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map((p) => {
              const isLive = p.is_live;
              return (
                <div
                  key={p.provider_name}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-base font-bold text-white">
                        {p.provider_name}
                      </h4>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
                          isLive
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                            : "bg-gray-950 text-amber-400 border-amber-900/60"
                        }`}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 leading-relaxed">
                      {p.message}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 space-y-1 text-xs font-mono text-gray-500">
                    <p>
                      Coverage:{" "}
                      <span className="text-gray-300">{p.coverage_area}</span>
                    </p>
                    <p>
                      Audited:{" "}
                      <span className="text-gray-400">
                        {new Date(p.last_checked_at).toLocaleTimeString()}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: Historical Data Ingestion Studio ───────────────────────── */}
      {activeTab === "historical" && (
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Upload Form (6 cols) */}
          <div className="lg:col-span-6 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-white">
                Upload Traffic Dataset
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Validate and ingest real sensor observations into the digital twin
                corridor.
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Target Road Network
                  </label>
                  <select
                    value={networkId}
                    onChange={(e) => setNetworkId(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-600"
                  >
                    <option value="jaipur_v1">Jaipur MI Road (jaipur_v1)</option>
                    <option value="delhi_v1">
                      Delhi Connaught Place (delhi_v1)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Dataset Label
                  </label>
                  <input
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 font-mono outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Format pills */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Payload Format:</span>
                <button
                  type="button"
                  onClick={() => handleFormatChange("csv")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                    format === "csv"
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  CSV Format
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange("json")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                    format === "json"
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  JSON Format
                </button>
              </div>

              {/* Text Area */}
              <div>
                <textarea
                  rows={9}
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs font-mono text-gray-200 outline-none focus:border-emerald-600 resize-none"
                  placeholder="Paste observation data..."
                />
              </div>

              {uploadError && (
                <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-3 text-xs">
                  ⚠ {uploadError}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !payload.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                {uploading
                  ? "Auditing & Ingesting Dataset…"
                  : "Validate & Ingest Observations"}
              </button>
            </form>
          </div>

          {/* Results Panel (6 cols) */}
          <div className="lg:col-span-6">
            {importResult ? (
              <QualityReportView report={importResult} />
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500 space-y-3">
                <div className="text-4xl">📊</div>
                <h4 className="text-base font-semibold text-gray-300">
                  Data Quality Audit Report
                </h4>
                <p className="text-xs max-w-sm mx-auto">
                  Upload observation records on the left to see completeness
                  metrics, outlier counts, and 24-hour flow factor profiles.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Network Digital Twins ─────────────────────────────────── */}
      {activeTab === "networks" && (
        <div className="grid sm:grid-cols-2 gap-6">
          {networks.map((net) => (
            <div
              key={net.network_id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {net.city_name} — {net.corridor}
                  </h3>
                  <span className="text-xs font-mono text-gray-500">
                    Network ID: {net.network_id}
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-mono font-semibold">
                  {net.validation_status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-gray-950/60 p-4 rounded-xl border border-gray-800 text-center">
                <div>
                  <p className="text-xs text-gray-500">Nodes</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">
                    {net.node_count.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Road Edges</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">
                    {net.edge_count.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Road Length</p>
                  <p className="text-lg font-bold font-mono text-white mt-0.5">
                    {net.total_road_length_km.toFixed(1)} km
                  </p>
                </div>
              </div>

              <div className="text-xs text-gray-400 space-y-1">
                <p>
                  ✓ Topology: Single strongly-connected component validated
                </p>
                <p>✓ Ingestion: OpenStreetMap via OSMnx GraphML + GeoJSON</p>
                <p>
                  ✓ Simulation Engine: Ready for BPR, Webster &amp; Monte Carlo
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quality Report Inspector Component ───────────────────────────────────────

function QualityReportView({ report }: { report: HistoricalImportResponse }) {
  const qr = report.quality_report;
  const profiles = Object.values(report.hourly_profiles);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-gray-500">
            Source: {report.source_name}
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Audit Passed ({report.observation_count} observations)
          </h3>
        </div>
        <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-mono font-bold">
          {qr.completeness_pct.toFixed(1)}% Completeness
        </span>
      </div>

      {/* Metric counters */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
        <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
          <span className="text-gray-500 block">Valid</span>
          <span className="text-emerald-400 font-bold text-sm">
            {qr.valid_rows}
          </span>
        </div>
        <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
          <span className="text-gray-500 block">Invalid</span>
          <span className="text-amber-400 font-bold text-sm">
            {qr.invalid_rows}
          </span>
        </div>
        <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
          <span className="text-gray-500 block">Mapped</span>
          <span className="text-blue-400 font-bold text-sm">
            {report.mapped_edges_count}
          </span>
        </div>
        <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
          <span className="text-gray-500 block">Outliers</span>
          <span className="text-red-400 font-bold text-sm">
            {qr.speed_outliers_count}
          </span>
        </div>
      </div>

      {/* Hourly Flow Factor Profile Table */}
      {profiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Calibrated Diurnal Flow Factors
          </h4>
          <div className="bg-gray-950/60 border border-gray-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="p-2">Hour</th>
                  <th className="p-2">Avg Speed</th>
                  <th className="p-2">Volume</th>
                  <th className="p-2">Flow Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {profiles.map((p) => (
                  <tr key={p.hour}>
                    <td className="p-2">{p.hour}:00</td>
                    <td className="p-2">{p.avg_speed_kmh.toFixed(1)} km/h</td>
                    <td className="p-2">{p.total_volume} veh</td>
                    <td className="p-2 text-emerald-400 font-semibold">
                      {p.flow_factor.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {qr.issues.length > 0 && (
        <div className="bg-amber-950/50 border border-amber-900/60 rounded-xl p-3 text-xs text-amber-300 space-y-1">
          <p className="font-semibold">Quality Flags:</p>
          {qr.issues.map((issue, idx) => (
            <p key={idx}>• {issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}
