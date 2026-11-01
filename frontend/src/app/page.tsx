import Link from "next/link";

/**
 * frontend/src/app/page.tsx
 *
 * Urbynex Landing Page — Phase 5 AI Copilot edition.
 * Stats reflect real committed network data (Jaipur + Delhi).
 */

const STATS = [
  { label: "Cities", value: "2" },
  { label: "Road Edges", value: "10,145" },
  { label: "Network Nodes", value: "5,425" },
  { label: "Monte Carlo Seeds", value: "5" },
  { label: "AI Documents", value: "2" },
  { label: "Simulation Engine", value: "BPR + Webster" },
];

const FEATURES = [
  {
    icon: "🗺️",
    title: "Real OSM Road Networks",
    desc: "Jaipur MI Road (2,538 nodes, 5,196 edges) and Delhi Connaught Place (2,887 nodes, 4,949 edges) ingested from OpenStreetMap via OSMnx.",
    href: "/cities",
    cta: "Explore Cities",
  },
  {
    icon: "📊",
    title: "BPR + Webster Simulation",
    desc: "Bureau of Public Roads link-performance function with dynamic congestion feedback, Webster intersection signal timing, and incident queue delay model.",
    href: "/simulations",
    cta: "View Simulations",
  },
  {
    icon: "🎲",
    title: "Monte Carlo Engine",
    desc: "5-seed stochastic batch simulation with 95% confidence intervals on travel time, speed, throughput and V/C ratio across the network.",
    href: "/scenarios",
    cta: "Run Scenarios",
  },
  {
    icon: "🤖",
    title: "AI Copilot (RAG)",
    desc: "Hybrid BM25 + cosine vector retrieval over indexed planning documents (Delhi MPD-2041, Jaipur CMP-2025) with approved tool execution and zero-fabrication policy.",
    href: "/ai",
    cta: "Open Copilot",
    highlight: true,
  },
  {
    icon: "⚖️",
    title: "Scenario Comparison",
    desc: "Compare baseline vs road closure, demand surge, or incident interventions side-by-side with per-metric delta and improvement indicators.",
    href: "/compare",
    cta: "Compare Runs",
  },
  {
    icon: "🌐",
    title: "Interactive Digital Twin",
    desc: "MapLibre GL powered city map with live edge congestion coloring, multi-city switching, auto-bounds fitting, and scenario overlay.",
    href: "/cities",
    cta: "View Map",
  },
];

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-20">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-950 border border-emerald-800 rounded-full text-emerald-400 text-xs font-mono">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Phase 5 · AI Copilot + RAG Engine
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Urbynex
          <span className="block text-emerald-400 mt-1">
            Smart City Digital Twin
          </span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
          Production-grade multi-city traffic simulation platform with AI
          copilot, real OSM road networks, BPR-calibrated engines, and
          stochastic Monte Carlo analysis.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/ai"
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-900/30"
          >
            🤖 Open AI Copilot
          </Link>
          <Link
            href="/cities"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors border border-gray-700"
          >
            Explore Cities
          </Link>
          <Link
            href="/scenarios"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors border border-gray-700"
          >
            Run Simulation
          </Link>
        </div>
      </div>

      {/* ── Platform Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center"
          >
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {s.value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Feature Grid ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Platform Capabilities</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`relative bg-gray-900 border rounded-2xl p-6 flex flex-col gap-3 transition-all hover:border-gray-600 ${
                f.highlight
                  ? "border-emerald-800 shadow-lg shadow-emerald-950/40"
                  : "border-gray-800"
              }`}
            >
              {f.highlight && (
                <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-900 border border-emerald-700 rounded-full text-emerald-400 text-xs font-mono">
                  NEW
                </span>
              )}
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-bold text-white">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                {f.desc}
              </p>
              <Link
                href={f.href}
                className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {f.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ── Architecture Note ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row gap-6">
        <div className="flex-1 space-y-2">
          <h3 className="font-bold text-white">Tech Stack</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>⚙ <span className="text-gray-300">Backend:</span> FastAPI · SQLite · Celery · NetworkX · OSMnx</li>
            <li>🧪 <span className="text-gray-300">Simulation:</span> BPR · Webster · Monte Carlo · BM25</li>
            <li>🌐 <span className="text-gray-300">Frontend:</span> Next.js 15 · Tailwind CSS · MapLibre GL</li>
            <li>🤖 <span className="text-gray-300">AI:</span> RAG · HybridVectorStore · ToolRegistry · AICopilotEngine</li>
          </ul>
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="font-bold text-white">Data Policy</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            All simulation metrics are generated by the BPR/Webster engine and
            labeled <code className="text-gray-300 bg-gray-800 px-1 rounded">SIMULATED</code>.
            AI Copilot answers are grounded in indexed planning documents and
            labeled <code className="text-gray-300 bg-gray-800 px-1 rounded">CITED_DOCUMENT</code>.
            No live traffic feeds are fabricated.
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-700 text-center pb-4">
        Urbynex · Smart City Digital Twin Platform · v1.0.0-dev · All simulation
        data is labeled and traceable
      </p>
    </div>
  );
}
