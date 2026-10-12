# Urbynex — Implementation Plan

## Phase Summary

| Phase | Name | Status |
|---|---|---|
| 0 | Repository Inspection and Planning | ✅ In Progress |
| 1 | Simulation Proof of Concept | 🔲 Not Started |
| 2 | Application Foundation | 🔲 Not Started |
| 3 | Scenario and Engine Expansion | 🔲 Not Started |
| 4 | Multi-City and Data Ingestion | 🔲 Not Started |
| 5 | RAG and AI Copilot | 🔲 Not Started |
| 6 | Product UI and Experience | 🔲 Not Started |
| 7 | Hardening and Deployment | 🔲 Not Started |

---

## Phase 0 — Repository Inspection and Planning

**Goal:** Understand the environment, define boundaries, produce an actionable plan.

### M0.1 — Environment Verified
- [x] Python 3.14.7 available
- [x] Node 24.13.0 available
- [x] Git 2.52.0 available
- [x] SUMO: NOT installed (Engine A will be primary for Phase 1)
- [x] Python packages: fresh environment (only pip)
- [x] GitHub repo: alokchoudhary885-coder/urbynex

### M0.2 — Planning Documents Created
- [x] README.md
- [x] docs/PROJECT_VISION.md
- [x] docs/ARCHITECTURE.md
- [x] docs/IMPLEMENTATION_PLAN.md (this file)
- [ ] docs/DATA_SOURCES.md
- [ ] docs/SIMULATION_MODEL.md
- [ ] docs/AI_AND_RAG.md
- [ ] docs/API_CONTRACTS.md
- [ ] docs/TESTING_STRATEGY.md
- [ ] docs/KNOWN_LIMITATIONS.md
- [ ] docs/DECISIONS.md
- [ ] docs/IMPLEMENTATION_TASKS.json

---

## Phase 1 — Simulation Proof of Concept

**Goal:** A working end-to-end simulation on a real Jaipur network extract with persisted, reproducible metrics.

**Exit criteria:** Baseline + demand-change runs complete, metrics stored, comparison works, tests pass.

### M1.1 — Python Environment Setup

**Task P1-T1:** Install backend dependencies

| Field | Value |
|---|---|
| ID | P1-T1 |
| Status | not_started |
| Prerequisites | Python 3.14 available |
| Files | backend/requirements.txt |

Subtasks:
- P1-T1-S1: Create `backend/requirements.txt` with pinned versions
- P1-T1-S2: Create Python virtual environment `backend/.venv`
- P1-T1-S3: Install packages and verify import
- P1-T1-S4: Verify osmnx can fetch a small OSM extract

Acceptance criteria:
- `python -c "import osmnx, networkx, fastapi, sqlalchemy"` exits 0
- osmnx can fetch a 500m radius network from Jaipur center point

---

### M1.2 — Jaipur Road Network Import

**Task P1-T2:** Extract and validate Jaipur MI Road corridor

| Field | Value |
|---|---|
| ID | P1-T2 |
| Status | not_started |
| Prerequisites | P1-T1 complete |
| Files | scripts/import_network.py, backend/simulation/network_loader.py, backend/data/networks/ |

Subtasks:
- P1-T2-S1: Define bounding box: MI Road to JLN Marg, Jaipur (approx 2km × 2km)
- P1-T2-S2: Fetch drive network via osmnx with `network_type='drive'`
- P1-T2-S3: Add missing speed (default 40 km/h) and lane (default 1) attributes
- P1-T2-S4: Calculate capacity per edge (lanes × 1800 veh/hr/lane)
- P1-T2-S5: Run connectivity check (largest connected component ≥ 95% of nodes)
- P1-T2-S6: Save network as GraphML + JSON metadata to `backend/data/networks/jaipur_v1/`
- P1-T2-S7: Record network stats: node count, edge count, total length, bounding box

Acceptance criteria:
- Network file saved and loads correctly
- All nodes reachable in largest connected component
- No edges with missing length attribute
- Metadata JSON contains version, bbox, source, import timestamp

---

### M1.3 — Graph Traffic Simulator (Engine A)

**Task P1-T3:** Build lightweight graph-based simulator

| Field | Value |
|---|---|
| ID | P1-T3 |
| Status | not_started |
| Prerequisites | P1-T2 complete |
| Files | backend/simulation/engines/graph_engine.py, backend/simulation/engines/base.py |

Subtasks:
- P1-T3-S1: Define abstract `SimulationEngine` base class with standard interface
- P1-T3-S2: Implement `SyntheticDemandGenerator`: origin-destination pairs, configurable vehicle count, departure time distribution, random seed
- P1-T3-S3: Implement shortest-path routing (Dijkstra via NetworkX)
- P1-T3-S4: Implement BPR travel-time function per edge: `t = t0 × (1 + 0.15 × (v/c)^4)`
- P1-T3-S5: Implement time-stepped simulation loop (configurable step size)
- P1-T3-S6: Collect per-vehicle: departure time, arrival time, route, distance
- P1-T3-S7: Compute aggregate metrics: completed trips, avg travel time, avg waiting time, avg distance, throughput, active vehicles
- P1-T3-S8: Support road closure: remove edge(s) and reroute affected vehicles
- P1-T3-S9: Support reproducible runs via `random.seed(seed)`

Acceptance criteria:
- `GraphEngine.run(scenario_config)` returns `SimulationResult` with all metrics
- Same seed produces identical results across runs
- Closing a major road increases average travel time (deterministic test network)
- 20% demand increase raises congestion metrics

---

### M1.4 — Metric Persistence

**Task P1-T4:** Save simulation runs and metrics to SQLite

| Field | Value |
|---|---|
| ID | P1-T4 |
| Status | not_started |
| Prerequisites | P1-T3 partial |
| Files | backend/db/models.py, backend/db/migrations/, backend/db/session.py |

Subtasks:
- P1-T4-S1: Define SQLAlchemy models: `SimulationRun`, `RunMetric`, `Scenario`, `CityNetwork`
- P1-T4-S2: Set up Alembic for migrations
- P1-T4-S3: Write initial migration creating all tables
- P1-T4-S4: Implement `RunRepository`: save run, update status, save metrics, retrieve by ID
- P1-T4-S5: Verify run config (scenario, seed, engine, network version) is stored per run

Acceptance criteria:
- Run persists with all required fields
- Metrics retrievable by run_id
- Status transitions: queued → running → completed/failed

---

### M1.5 — Scenario Comparison

**Task P1-T5:** Compare two compatible simulation runs

| Field | Value |
|---|---|
| ID | P1-T5 |
| Status | not_started |
| Prerequisites | P1-T4 complete |
| Files | backend/simulation/comparison.py |

Subtasks:
- P1-T5-S1: Implement `compare_runs(baseline_id, target_id)` → `ComparisonResult`
- P1-T5-S2: Check compatibility: same city, network version, engine, duration
- P1-T5-S3: Calculate absolute and percentage differences per metric
- P1-T5-S4: Apply metric-specific improvement logic (e.g., lower travel time = better, lower throughput = worse)
- P1-T5-S5: Add warnings for incompatible run configurations

Acceptance criteria:
- Comparison works for baseline vs +20% demand runs
- Improvement/deterioration correctly classified per metric
- Incompatible runs rejected with explanation

---

### M1.6 — Phase 1 Tests

**Task P1-T6:** Deterministic tests for simulation correctness

| Field | Value |
|---|---|
| ID | P1-T6 |
| Status | not_started |
| Prerequisites | P1-T3, P1-T4, P1-T5 |
| Files | backend/tests/test_graph_engine.py, backend/tests/test_network_loader.py, backend/tests/test_comparison.py |

Subtasks:
- P1-T6-S1: Build a 5-node deterministic test network with known capacities
- P1-T6-S2: Test that closing one edge reroutes vehicles to alternate path
- P1-T6-S3: Test that 20% demand increase raises average travel time
- P1-T6-S4: Test metric extraction produces correct types and units
- P1-T6-S5: Test that same seed produces identical results
- P1-T6-S6: Test comparison logic classifies improvements correctly

---

## Phase 2 — Application Foundation

**Goal:** FastAPI backend + Next.js frontend connected to real simulation data.

### Key Milestones
- M2.1: FastAPI project structure, routes, Pydantic schemas
- M2.2: Authentication (JWT, user registration/login)
- M2.3: Celery + Redis job queue for simulation runs
- M2.4: Next.js project setup, API client, basic pages
- M2.5: City Explorer page with real map (MapLibre + OSM tiles)
- M2.6: Scenario Builder → submit → monitor → view results

---

## Phase 3 — Scenario and Engine Expansion

**Goal:** All 6 scenario types working, SUMO adapter optional.

### Key Milestones
- M3.1: Road closure scenario (edge removal + rerouting)
- M3.2: Signal timing scenario (configurable phase splits)
- M3.3: Traffic incident scenario (capacity/speed reduction)
- M3.4: Live-informed and historical-informed scenarios
- M3.5: SUMO adapter (when binary available)
- M3.6: Reproducibility metadata and multi-seed runs

---

## Phase 4 — Multi-City and Data Ingestion

**Goal:** Delhi network added, historical CSV/JSON import working.

### Key Milestones
- M4.1: Delhi Connaught Place corridor network
- M4.2: Network versioning and city metadata API
- M4.3: Historical CSV/JSON import with schema validation
- M4.4: Data quality reports and coverage indicators
- M4.5: Live provider adapter framework (graceful unavailable state)

---

## Phase 5 — RAG and AI Copilot

**Goal:** AI can answer questions grounded in simulation data and planning documents.

### Key Milestones
- M5.1: Document ingestion (PDF/TXT), chunking, embedding, ChromaDB index
- M5.2: Hybrid retrieval (semantic + keyword) with access filtering
- M5.3: Gemini Function Calling integration with approved tool registry
- M5.4: AI workflow: classify → retrieve → validate → confirm → execute → explain
- M5.5: Citation generation and groundedness checks

---

## Phase 6 — Product UI and Experience

**Goal:** All 8 pages complete, data-connected, professional design.

### Key Milestones
- M6.1: Landing page
- M6.2: Simulation Monitor with real job status
- M6.3: Results & Analytics with real charts and map overlays
- M6.4: Scenario Comparison page
- M6.5: AI Copilot chat interface with tool execution cards
- M6.6: Data Management page

---

## Phase 7 — Hardening and Deployment

**Goal:** Reproducible setup, tested features, deployment-ready.

### Key Milestones
- M7.1: Complete test suite (unit, integration, E2E)
- M7.2: Logging, timeouts, resource limits
- M7.3: Docker Compose configuration
- M7.4: Environment templates and setup documentation
- M7.5: Final acceptance test run

---

## Dependency Graph (Critical Path)

```
P0 (Plan) → P1-T1 (Env) → P1-T2 (Network) → P1-T3 (Engine)
                                                     ↓
                                             P1-T4 (Persist) → P1-T5 (Compare) → P1-T6 (Tests)
                                                     ↓
                                              Phase 2 (App Foundation)
                                                     ↓
                                              Phase 3 (Scenarios)
                                                     ↓
                                     Phase 4 (Multi-city) + Phase 5 (AI/RAG)
                                                     ↓
                                              Phase 6 (Full UI)
                                                     ↓
                                              Phase 7 (Hardening)
```

## High-Risk Assumptions

| Risk | Mitigation |
|---|---|
| SUMO not installed | Engine A is fully self-contained; SUMO is optional |
| OSMnx API rate limits | Cache network files; network import is a one-time script |
| Signal data missing from OSM | Document limitation; disable signal timing experiments until data available |
| Gemini API quota | Implement response caching; rate limit AI endpoints |
| Delhi OSM network quality | Validate connectivity before marking network ready |
| Live traffic API coverage | Build graceful unavailable state from day one |
