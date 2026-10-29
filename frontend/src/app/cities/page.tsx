"use client";

import { useCities, useCityNetworks } from "@/lib/hooks/useApi";
import Link from "next/link";

export default function CitiesPage() {
  const { data: citiesData, loading, error } = useCities();

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading cities…
      </div>
    );

  if (error)
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          Failed to load cities: {error}
        </div>
        <p className="text-gray-500 text-sm mt-3">
          Make sure the backend is running:{" "}
          <code className="text-gray-400">uvicorn backend.api.main:app --reload</code>
        </p>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Cities</h1>
      <p className="text-gray-400 mb-8 text-sm">
        {citiesData?.total ?? 0} registered city with available road networks.
      </p>

      <div className="grid gap-4">
        {citiesData?.cities.map((city) => (
          <CityCard key={city.city_id} cityId={city.city_id} city={city} />
        ))}
      </div>
    </div>
  );
}

function CityCard({
  cityId,
  city,
}: {
  cityId: string;
  city: { name: string; country: string; status: string; networks_available: number; description: string };
}) {
  const { data: networksData } = useCityNetworks(cityId);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{city.name}</h2>
          <p className="text-gray-500 text-sm">{city.country}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            city.status === "network_ready"
              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
              : "bg-yellow-950 text-yellow-400 border border-yellow-800"
          }`}
        >
          {city.status}
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-4">{city.description}</p>

      {networksData?.networks.map((net) => (
        <div
          key={net.network_id}
          className="bg-gray-800 rounded-lg p-4 mb-3 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-sm font-medium text-gray-200">{net.corridor}</p>
            <p className="text-xs text-gray-500 mt-1">
              {net.node_count.toLocaleString()} nodes · {net.edge_count.toLocaleString()} edges ·{" "}
              {net.total_road_length_km.toFixed(1)} km
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/scenarios?network_id=${net.network_id}&city_id=${cityId}`}
              className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-colors"
            >
              New Scenario
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
