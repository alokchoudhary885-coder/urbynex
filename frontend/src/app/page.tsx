import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center text-center gap-10">
      {/* Hero */}
      <div className="space-y-4">
        <div className="inline-block px-3 py-1 bg-emerald-950 border border-emerald-800 rounded-full text-emerald-400 text-xs font-mono mb-2">
          Phase 2 — Application Foundation
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-white">
          Urbynex
          <span className="block text-emerald-400 mt-1">Smart City Digital Twin</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          AI-powered multi-city traffic simulation platform. Model real road
          networks, run BPR-calibrated simulations, compare scenarios, and
          explore congestion on an interactive map.
        </p>
      </div>

      {/* CTA Buttons */}
      <div className="flex gap-4 flex-wrap justify-center">
        <Link
          href="/cities"
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
        >
          Explore Cities
        </Link>
        <Link
          href="/simulations"
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors border border-gray-700"
        >
          View Simulations
        </Link>
      </div>

      {/* Feature Cards */}
      <div className="grid sm:grid-cols-3 gap-6 w-full mt-4">
        {[
          {
            icon: "🗺️",
            title: "Real OSM Networks",
            desc: "Jaipur MI Road corridor — 2,538 nodes, 5,196 edges from OpenStreetMap.",
          },
          {
            icon: "🚗",
            title: "BPR Simulation",
            desc: "Bureau of Public Roads link-performance function with dynamic congestion feedback.",
          },
          {
            icon: "📊",
            title: "Scenario Comparison",
            desc: "Compare baseline vs road closure, demand surge, or incidents side-by-side.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-left"
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="font-semibold text-white mb-1">{card.title}</h3>
            <p className="text-sm text-gray-400">{card.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4 max-w-xl">
        Traffic demand is synthetically generated for simulation purposes.
        All simulations are labeled{" "}
        <code className="text-gray-500">SIMULATED</code>.
        No live traffic data is used in this version.
      </p>
    </div>
  );
}
