/**
 * frontend/src/lib/api/client.ts
 *
 * Typed HTTP client for the Urbynex FastAPI backend.
 *
 * Usage:
 *   import { api } from "@/lib/api/client";
 *   const cities = await api.getCities();
 */

import type {
  City,
  CityNetwork,
  Scenario,
  CreateScenarioRequest,
  SimulationRunStatus,
  SimulationMetrics,
  RunSimulationRequest,
  MonteCarloRunRequest,
  MonteCarloResponse,
  CompareRequest,
  ComparisonResult,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserProfile,
  WorkerStatus,
  ApiError,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.message ?? `HTTP ${status}`);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // No-store: simulation results change; let callers add caching headers
    cache: "no-store",
  });

  if (!res.ok) {
    let errBody: ApiError;
    try {
      errBody = await res.json();
    } catch {
      errBody = { error: "unknown", message: `HTTP ${res.status}` };
    }
    throw new ApiClientError(res.status, errBody);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string, token?: string) =>
  request<T>("GET", path, undefined, token);
const post = <T>(path: string, body: unknown, token?: string) =>
  request<T>("POST", path, body, token);

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export const api = {
  // ── Cities & Networks ────────────────────────────────────────────────────

  getCities: (): Promise<{ cities: City[]; total: number }> =>
    get("/cities"),

  getCityNetworks: (
    cityId?: string,
  ): Promise<{ networks: CityNetwork[]; total: number }> =>
    get(cityId ? `/networks?city_id=${cityId}` : "/networks"),

  getNetworkGeoJSON: (networkId: string): Promise<object> =>
    get(`/networks/${networkId}/geojson`),

  getNetworkEdges: (
    networkId: string,
    limit = 500,
  ): Promise<{ features: object[]; total: number }> =>
    get(`/networks/${networkId}/edges?limit=${limit}`),

  // ── Scenarios ────────────────────────────────────────────────────────────

  createScenario: (
    req: CreateScenarioRequest,
    token?: string,
  ): Promise<Scenario> => post("/scenarios", req, token),

  getScenario: (scenarioId: string, token?: string): Promise<Scenario> =>
    get(`/scenarios/${scenarioId}`, token),

  listScenarios: (
    cityId?: string,
    token?: string,
  ): Promise<{ scenarios: Scenario[]; total: number }> =>
    get(cityId ? `/scenarios?city_id=${cityId}` : "/scenarios", token),

  // ── Simulations ──────────────────────────────────────────────────────────

  runSimulation: (
    req: RunSimulationRequest,
    token?: string,
  ): Promise<SimulationRunStatus> => post("/simulations/run", req, token),

  getSimulationStatus: (
    runId: string,
    token?: string,
  ): Promise<SimulationRunStatus> => get(`/simulations/${runId}`, token),

  getSimulationMetrics: (
    runId: string,
    token?: string,
  ): Promise<SimulationMetrics> => get(`/simulations/${runId}/metrics`, token),

  listSimulations: (
    limit = 20,
    token?: string,
  ): Promise<{ runs: SimulationRunStatus[]; total: number }> =>
    get(`/simulations?limit=${limit}`, token),

  runMonteCarlo: (
    req: MonteCarloRunRequest,
    token?: string,
  ): Promise<MonteCarloResponse> => post("/simulations/monte-carlo", req, token),

  // ── Comparison ────────────────────────────────────────────────────────────

  compareRuns: (
    req: CompareRequest,
    token?: string,
  ): Promise<ComparisonResult> => post("/compare", req, token),

  // ── Auth ──────────────────────────────────────────────────────────────────

  login: (req: LoginRequest): Promise<TokenResponse> =>
    post("/auth/login", req),

  register: (req: RegisterRequest): Promise<TokenResponse> =>
    post("/auth/register", req),

  getMe: (token: string): Promise<UserProfile> => get("/auth/me", token),

  // ── Worker Status ────────────────────────────────────────────────────────

  getWorkerStatus: (): Promise<WorkerStatus> => get("/worker/status"),

  // ── Health ────────────────────────────────────────────────────────────────

  health: (): Promise<{ status: string; version: string }> => get("/health"),
};

export { ApiClientError };
