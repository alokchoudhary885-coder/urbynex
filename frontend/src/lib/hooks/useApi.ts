/**
 * frontend/src/lib/hooks/useApi.ts
 *
 * Generic SWR-style React hooks for data fetching from the Urbynex API.
 * Uses React's built-in useState/useEffect — no extra dependencies.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import type {
  SimulationRunStatus,
  SimulationMetrics,
} from "@/lib/api/types";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useFetch<T>(fetcher: () => Promise<T>): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.body.message
              : err instanceof Error
                ? err.message
                : "Unknown error",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Exported hooks
// ---------------------------------------------------------------------------

export function useCities() {
  return useFetch(() => api.getCities());
}

export function useCityNetworks(cityId?: string) {
  return useFetch(() => api.getCityNetworks(cityId));
}

export function useScenarios(cityId?: string, token?: string) {
  return useFetch(() => api.listScenarios(cityId, token));
}

export function useSimulationStatus(runId: string | null, token?: string) {
  const [data, setData] = useState<SimulationRunStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    const poll = async () => {
      setLoading(true);
      try {
        const result = await api.getSimulationStatus(runId, token);
        if (!cancelled) {
          setData(result);
          setLoading(false);
          // Keep polling while job is running/queued
          if (result.status === "queued" || result.status === "running") {
            setTimeout(poll, 2000);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Poll failed");
          setLoading(false);
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [runId, token]);

  return { data, loading, error };
}

export function useSimulationMetrics(runId: string | null, token?: string) {
  return useFetch(() =>
    runId ? api.getSimulationMetrics(runId, token) : Promise.resolve(null as unknown as SimulationMetrics),
  );
}

export function useWorkerStatus(): FetchState<ReturnType<typeof api.getWorkerStatus> extends Promise<infer T> ? T : never> {
  return useFetch(() => api.getWorkerStatus());
}
