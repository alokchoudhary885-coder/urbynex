/**
 * frontend/src/lib/api/types.ts
 *
 * Shared TypeScript types mirroring the FastAPI Pydantic schemas.
 * Keep in sync with backend/api/schemas/*.py
 */

// ── Cities & Networks ────────────────────────────────────────────────────────

export interface City {
  city_id: string;
  name: string;
  country: string;
  status: "network_ready" | "validating" | "unavailable";
  networks_available: number;
  description: string;
}

export interface CityNetwork {
  network_id: string;
  city_id: string;
  city_name: string;
  corridor: string;
  version: string;
  node_count: number;
  edge_count: number;
  total_road_length_km: number;
  validation_status: string;
  simulation_ready: boolean;
}

// ── Scenarios ────────────────────────────────────────────────────────────────

export type ScenarioType =
  | "baseline"
  | "demand_change"
  | "road_closure"
  | "incident"
  | "signal_timing"
  | "historical";

export interface DemandConfig {
  vehicle_count: number;
  duration_seconds: number;
  seed?: number;
  demand_profile?: "uniform" | "morning_peak" | "evening_peak" | "weekend";
}

export interface RoadClosureIntervention {
  edge_ids: string[];
  description?: string;
}

export interface IncidentIntervention {
  edge_ids: string[];
  capacity_reduction_factor?: number;
  speed_reduction_factor?: number;
}

export interface CreateScenarioRequest {
  name: string;
  description?: string;
  city_id: string;
  network_id: string;
  scenario_type: ScenarioType;
  demand: DemandConfig;
  closures?: RoadClosureIntervention;
  incidents?: IncidentIntervention;
}

export interface Scenario {
  scenario_id: string;
  name: string;
  description: string;
  city_id: string;
  network_id: string;
  scenario_type: ScenarioType;
  demand: DemandConfig;
  created_at: string;
  updated_at: string;
}

// ── Simulation Runs ──────────────────────────────────────────────────────────

export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface SimulationRunStatus {
  run_id: string;
  scenario_id: string;
  status: RunStatus;
  engine: string;
  network_id: string;
  seed: number;
  submitted_at?: string;
  completed_at?: string;
  execution_time_seconds?: number;
  error?: string;
}

export interface MetricItem {
  value: number;
  unit: string;
  available: boolean;
  description: string;
}

export interface SimulationMetrics {
  run_id: string;
  scenario_id: string;
  status: RunStatus;
  engine: string;
  network_id: string;
  seed: number;
  metrics: Record<string, MetricItem>;
  edge_metrics?: Record<string, EdgeMetric>;
  assumptions: string[];
  warnings: string[];
  data_label: string;
  execution_time_seconds?: number;
  created_at?: string;
}

export interface EdgeMetric {
  edge_id: string;
  length_m: number;
  free_flow_time_s: number;
  actual_travel_time_s: number;
  volume_veh: number;
  capacity_veh_hr: number;
  volume_to_capacity_ratio: number;
  average_speed_kmh: number;
  congested: boolean;
  closed: boolean;
}

export interface RunSimulationRequest {
  scenario_id: string;
  engine?: string;
  seed_override?: number;
  run_async?: boolean;
}

// ── Comparison ────────────────────────────────────────────────────────────────

export interface CompareRequest {
  baseline_run_id: string;
  target_run_id: string;
}

export interface MetricDiff {
  metric_name: string;
  baseline_value: number;
  target_value: number;
  absolute_change: number;
  percent_change: number;
  improved: boolean;
  unit: string;
}

export interface ComparisonResult {
  baseline_run_id: string;
  target_run_id: string;
  compatible: boolean;
  metric_diffs: MetricDiff[];
  warnings: string[];
  summary: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  email: string;
  name: string;
  role: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at?: string;
}

// ── Worker Status ────────────────────────────────────────────────────────────

export interface WorkerStatus {
  redis_available: boolean;
  celery_workers: string[];
  dispatch_mode: "celery" | "background_task_fallback";
  broker_url: string;
}

// ── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  field?: string;
  request_id?: string;
}
