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

// ── Monte Carlo Simulation (M3.5/M3.6) ────────────────────────────────────────

export interface MonteCarloRunRequest {
  scenario_id: string;
  seeds?: number[];
  engine?: string;
}

export interface MonteCarloMetricSummary {
  metric_name: string;
  unit: string;
  mean: number;
  std_dev: number;
  min_value: number;
  max_value: number;
  ci_95_lower: number;
  ci_95_upper: number;
}

export interface MonteCarloResponse {
  scenario_id: string;
  seed_count: number;
  seeds: number[];
  metrics_summary: Record<string, MonteCarloMetricSummary>;
  individual_run_ids: string[];
  total_execution_time_seconds: number;
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

// ── AI Copilot (Phase 5) ──────────────────────────────────────────────────────

export interface CopilotChatRequest {
  query: string;
  city_id?: string;
  max_results?: number;
}

export interface CopilotAuditEntry {
  tool_name: string;
  approved: boolean;
  timestamp: string;
  result_summary?: string;
}

export interface CopilotChatResponse {
  query: string;
  answer: string;
  citations: string[];
  data_label: "CITED_DOCUMENT" | "SIMULATED" | "UNCERTAIN" | "INSUFFICIENT_EVIDENCE" | string;
  tools_used: string[];
  confidence: number;
  audit_log?: CopilotAuditEntry[];
  processing_time_ms?: number;
}

export interface CopilotTool {
  name: string;
  description: string;
  requires_auth: boolean;
}

export interface CopilotToolsResponse {
  tools: CopilotTool[];
  total: number;
}

// ── Data Ingestion & Live Providers (Phase 4 / Phase 6) ──────────────────────

export interface DataQualityReport {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  unmapped_edges_count: number;
  completeness_pct: number;
  min_timestamp?: string;
  max_timestamp?: string;
  speed_outliers_count: number;
  issues: string[];
}

export interface HourlyProfile {
  hour: number;
  avg_speed_kmh: number;
  total_volume: number;
  sample_count: number;
  flow_factor: number;
}

export interface HistoricalImportResponse {
  source_name: string;
  format: string;
  observation_count: number;
  quality_report: DataQualityReport;
  hourly_profiles: Record<string, HourlyProfile>;
  mapped_edges_count: number;
}

export interface LiveProviderStatus {
  provider_name: string;
  status: string;
  is_live: boolean;
  coverage_area: string;
  message: string;
  last_checked_at: string;
}

export interface LiveProvidersListResponse {
  providers: LiveProviderStatus[];
  any_live: boolean;
}

// ── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  field?: string;
  request_id?: string;
}
