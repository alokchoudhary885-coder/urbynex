"use client";

/**
 * frontend/src/app/(inner)/data/page.tsx
 *
 * Command Center Data Management & Quality Studio
 * - Live Traffic Provider health & zero-fabrication telemetry
 * - Historical CSV/JSON dataset upload with automated schema & quality auditing
 * - Network versioning & multi-city GIS layer registry (Jaipur, Delhi, Bengaluru)
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
    <div
      className="min-h-screen px-6 py-6 space-y-6"
      style={{ background: "#06111C", color: "#EAF3F8" }}
    >
      {/* Page Header */}
      <div className="pb-4" style={{ borderBottom: "1px solid #1B3445" }}>
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-mono mb-2" style={{ background: "rgba(0,184,217,0.12)", color: "#00B8D9", border: "1px solid rgba(0,184,217,0.3)" }}>
          DATA ENGINEERING &amp; TELEMETRY GOVERNANCE
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span style={{ color: "#00B8D9" }}>💾</span> Data Management &amp; Ingestion Studio
        </h1>
        <p className="text-xs mt-0.5 max-w-2xl" style={{ color: "#8DA5B5" }}>
          Audit live traffic telemetry feeds, upload historical speed/volume
          datasets, and inspect multi-city road network digital twin versioning.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4" style={{ borderBottom: "1px solid #1B3445" }}>
        {[
          { id: "live", label: "Live Telemetry Feeds", icon: "🛰️" },
          { id: "historical", label: "Historical Data Ingestion", icon: "📥" },
          { id: "networks", label: "Network Digital Twins", icon: "🗺️" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="pb-2.5 text-xs font-semibold flex items-center gap-2 transition-colors relative"
            style={{
              color: activeTab === tab.id ? "#00B8D9" : "#8DA5B5",
              borderBottom: activeTab === tab.id ? "2px solid #00B8D9" : "2px solid transparent",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: Live Telemetry Providers ──────────────────────────────── */}
      {activeTab === "live" && (
        <div className="space-y-5">
          {/* Zero-Fabrication Disclosure Card */}
          <div
            className="p-5 rounded-lg flex flex-col md:flex-row gap-5 items-start"
            style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
          >
            <div className="text-2xl" style={{ color: "#00B8D9" }}>🛡️</div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-white">
                Zero-Fabrication Data Policy
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "#8DA5B5" }}>
                Urbynex enforces strict data provenance. Third-party live traffic
                feeds (TomTom, Google Routes, HERE) require verified API
                credentials in environment variables. If an adapter lacks API
                keys, it is transparently reported as{" "}
                <code
                  className="px-1.5 py-0.5 rounded font-mono text-[11px]"
                  style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                >
                  credentials_missing
                </code>
                . We never invent fake real-time telemetry.
              </p>
            </div>
          </div>

          {/* Providers Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((p) => {
              const isLive = p.is_live;
              return (
                <div
                  key={p.provider_name}
                  className="p-4 rounded-lg flex flex-col justify-between space-y-3"
                  style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        {p.provider_name}
                      </h4>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                        style={{
                          background: isLive ? "rgba(54,198,160,0.12)" : "rgba(245,166,35,0.12)",
                          color: isLive ? "#36C6A0" : "#F5A623",
                          border: `1px solid ${isLive ? "rgba(54,198,160,0.3)" : "rgba(245,166,35,0.3)"}`,
                        }}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed" style={{ color: "#8DA5B5" }}>
                      {p.message}
                    </p>
                  </div>

                  <div className="pt-2.5 space-y-1 text-xs font-mono" style={{ borderTop: "1px solid #1B3445", color: "#8DA5B5" }}>
                    <p>
                      Coverage:{" "}
                      <span className="text-white">{p.coverage_area}</span>
                    </p>
                    <p>
                      Audited:{" "}
                      <span>
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
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Upload Form (6 cols) */}
          <div
            className="lg:col-span-6 p-5 rounded-lg space-y-4"
            style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
          >
            <div>
              <h3 className="text-sm font-bold text-white">
                Upload Traffic Dataset
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "#8DA5B5" }}>
                Validate and ingest real sensor observations into the digital twin corridor.
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-mono block mb-1" style={{ color: "#8DA5B5" }}>
                    Target Road Network
                  </label>
                  <select
                    value={networkId}
                    onChange={(e) => setNetworkId(e.target.value)}
                    className="w-full rounded px-2.5 py-1.5 text-xs font-mono outline-none"
                    style={{ background: "#06111C", border: "1px solid #1B3445", color: "#EAF3F8" }}
                  >
                    <option value="jaipur_v1">Jaipur MI Road (jaipur_v1)</option>
                    <option value="delhi_v1">Delhi Connaught Place (delhi_v1)</option>
                    <option value="bengaluru_v1">Bengaluru Silk Board - ORR (bengaluru_v1)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono block mb-1" style={{ color: "#8DA5B5" }}>
                    Dataset Label
                  </label>
                  <input
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    className="w-full rounded px-2.5 py-1.5 text-xs font-mono outline-none"
                    style={{ background: "#06111C", border: "1px solid #1B3445", color: "#EAF3F8" }}
                  />
                </div>
              </div>

              {/* Format pills */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono" style={{ color: "#8DA5B5" }}>Payload Format:</span>
                <button
                  type="button"
                  onClick={() => handleFormatChange("csv")}
                  className="px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
                  style={{
                    background: format === "csv" ? "#00B8D9" : "transparent",
                    color: format === "csv" ? "#06111C" : "#8DA5B5",
                    border: "1px solid #1B3445",
                  }}
                >
                  CSV Format
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange("json")}
                  className="px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
                  style={{
                    background: format === "json" ? "#00B8D9" : "transparent",
                    color: format === "json" ? "#06111C" : "#8DA5B5",
                    border: "1px solid #1B3445",
                  }}
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
                  className="w-full rounded p-3 text-xs font-mono outline-none resize-none"
                  style={{
                    background: "#06111C",
                    border: "1px solid #1B3445",
                    color: "#EAF3F8",
                  }}
                  placeholder="Paste observation data..."
                />
              </div>

              {uploadError && (
                <div
                  className="p-3 rounded text-xs font-mono"
                  style={{ background: "rgba(239,83,80,0.12)", border: "1px solid #EF5350", color: "#EF5350" }}
                >
                  ⚠ {uploadError}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !payload.trim()}
                className="w-full py-2 text-xs font-mono font-medium rounded transition-colors disabled:opacity-50"
                style={{
                  background: "#00B8D9",
                  color: "#06111C",
                }}
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
              <div
                className="p-12 text-center space-y-3 rounded-lg"
                style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
              >
                <div className="text-3xl">📊</div>
                <h4 className="text-sm font-semibold text-white">
                  Data Quality Audit Report
                </h4>
                <p className="text-xs max-w-sm mx-auto" style={{ color: "#8DA5B5" }}>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {networks.map((net) => (
            <div
              key={net.network_id}
              className="p-5 rounded-lg space-y-3"
              style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {net.city_name} — {net.corridor}
                  </h3>
                  <span className="text-[11px] font-mono" style={{ color: "#00B8D9" }}>
                    ID: {net.network_id}
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                  style={{ background: "rgba(54,198,160,0.12)", color: "#36C6A0", border: "1px solid rgba(54,198,160,0.3)" }}
                >
                  {net.validation_status.toUpperCase()}
                </span>
              </div>

              <div
                className="grid grid-cols-3 gap-2 p-3 rounded text-center"
                style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}
              >
                <div>
                  <p className="text-[10px] uppercase font-mono" style={{ color: "#8DA5B5" }}>Nodes</p>
                  <p className="text-sm font-bold font-mono text-white mt-0.5">
                    {net.node_count.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono" style={{ color: "#8DA5B5" }}>Edges</p>
                  <p className="text-sm font-bold font-mono text-white mt-0.5">
                    {net.edge_count.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono" style={{ color: "#8DA5B5" }}>Length</p>
                  <p className="text-sm font-bold font-mono text-white mt-0.5">
                    {net.total_road_length_km.toFixed(1)} km
                  </p>
                </div>
              </div>

              <div className="text-xs space-y-1 pt-1" style={{ color: "#8DA5B5" }}>
                <p>
                  ✓ Topology: Single strongly-connected component validated
                </p>
                <p>✓ Ingestion: OpenStreetMap via OSMnx GraphML + GeoJSON</p>
                <p>
                  ✓ Engine: BPR link performance, Webster signals &amp; Monte Carlo
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
    <div
      className="p-5 rounded-lg space-y-4"
      style={{ background: "#0B1D2B", border: "1px solid #1B3445" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono" style={{ color: "#8DA5B5" }}>
            Source: {report.source_name}
          </span>
          <h3 className="text-sm font-bold text-white mt-0.5">
            Audit Passed ({report.observation_count} observations)
          </h3>
        </div>
        <span
          className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold"
          style={{ background: "rgba(54,198,160,0.12)", color: "#36C6A0", border: "1px solid rgba(54,198,160,0.3)" }}
        >
          {qr.completeness_pct.toFixed(1)}% Completeness
        </span>
      </div>

      {/* Metric counters */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
        <div className="p-2 rounded" style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}>
          <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Valid</span>
          <span className="font-bold text-xs" style={{ color: "#36C6A0" }}>
            {qr.valid_rows}
          </span>
        </div>
        <div className="p-2 rounded" style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}>
          <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Invalid</span>
          <span className="font-bold text-xs" style={{ color: "#F5A623" }}>
            {qr.invalid_rows}
          </span>
        </div>
        <div className="p-2 rounded" style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}>
          <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Mapped</span>
          <span className="font-bold text-xs" style={{ color: "#00B8D9" }}>
            {report.mapped_edges_count}
          </span>
        </div>
        <div className="p-2 rounded" style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}>
          <span className="block text-[10px]" style={{ color: "#8DA5B5" }}>Outliers</span>
          <span className="font-bold text-xs" style={{ color: "#EF5350" }}>
            {qr.speed_outliers_count}
          </span>
        </div>
      </div>

      {/* Hourly Flow Factor Profile Table */}
      {profiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#00B8D9" }}>
            Calibrated Diurnal Flow Factors
          </h4>
          <div
            className="rounded overflow-hidden max-h-48 overflow-y-auto"
            style={{ background: "rgba(6,17,28,0.7)", border: "1px solid #1B3445" }}
          >
            <table className="w-full text-left text-xs font-mono">
              <thead style={{ background: "#06111C", color: "#8DA5B5" }}>
                <tr>
                  <th className="p-2">Hour</th>
                  <th className="p-2">Avg Speed</th>
                  <th className="p-2">Volume</th>
                  <th className="p-2">Flow Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B3445]" style={{ color: "#EAF3F8" }}>
                {profiles.map((p) => (
                  <tr key={p.hour}>
                    <td className="p-2">{p.hour}:00</td>
                    <td className="p-2">{p.avg_speed_kmh.toFixed(1)} km/h</td>
                    <td className="p-2">{p.total_volume} veh</td>
                    <td className="p-2 font-semibold" style={{ color: "#36C6A0" }}>
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
        <div
          className="p-2.5 rounded text-xs space-y-1 font-mono"
          style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "#F5A623" }}
        >
          <p className="font-semibold text-[11px]">Quality Flags:</p>
          {qr.issues.map((issue, idx) => (
            <p key={idx}>• {issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}
