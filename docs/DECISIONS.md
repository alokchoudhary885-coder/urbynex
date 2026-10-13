# Urbynex — Decisions Log

This document records significant technical decisions, the options considered, and the rationale chosen.

---

## D-001: Primary Simulation Engine for Phase 1

**Date:** 2026-10-12  
**Decision:** Use Engine A (Lightweight Graph Simulator) as the primary engine for Phase 1 and Phase 2.  
**Options considered:**
- Option A: Engine A first, SUMO optional later → **CHOSEN**
- Option B: SUMO from day one → Rejected (SUMO not installed; installation adds complexity)

**Rationale:** SUMO is not installed in the current environment. Engine A using Python + NetworkX + BPR allows a self-contained simulation that works immediately without external binaries. SUMO will be added as an optional adapter in Phase 3 when it can be properly installed and validated.

---

## D-002: Database for Phase 1

**Date:** 2026-10-12  
**Decision:** SQLite with WAL mode for Phase 1 and Phase 2.  
**Options considered:**
- Option A: SQLite → **CHOSEN**
- Option B: PostgreSQL from day one → Deferred (adds setup complexity without benefit at current scale)

**Rationale:** SQLite with WAL mode is sufficient for single-user development and testing. PostgreSQL migration path will be documented and implemented in Phase 7 when multi-user production deployment is targeted.

---

## D-003: Road Network Scope for Phase 1

**Date:** 2026-10-12  
**Decision:** Jaipur MI Road–JLN Marg corridor (~2km×2km bounding box)  
**Options considered:**
- Option A: Small corridor → **CHOSEN**
- Option B: Entire Jaipur city → Rejected (too large, computationally expensive, harder to validate)

**Rationale:** A small, well-connected corridor allows full end-to-end validation of the simulation workflow. Adding more network area is straightforward once the pipeline works.

---

## D-004: AI Provider

**Date:** 2026-10-12  
**Decision:** Google Gemini API with Function Calling  
**Options considered:**
- Option A: Gemini API → **CHOSEN**
- Option B: OpenAI GPT-4 → Not chosen (additional cost and setup)
- Option C: Local LLM → Rejected (insufficient quality for complex tool calling)

**Rationale:** Gemini API supports Function Calling with structured tool schemas, which is required for the controlled AI workflow. It is available and well-documented.

---

## D-005: Task Queue

**Date:** 2026-10-12  
**Decision:** Celery + Redis for background simulation jobs  
**Options considered:**
- Option A: Celery + Redis → **CHOSEN**
- Option B: FastAPI BackgroundTasks → Rejected (not suitable for long-running jobs; no retry/monitoring)
- Option C: RQ (Redis Queue) → Not chosen (Celery has better monitoring tooling)

**Rationale:** Simulations can take seconds to minutes. They must not block API requests. Celery + Redis provides job status tracking, retry, and monitoring.

---

## D-006: Map Library

**Date:** 2026-10-12  
**Decision:** MapLibre GL JS  
**Options considered:**
- Option A: MapLibre GL JS → **CHOSEN** (open source, vector tiles, flexible styling)
- Option B: Mapbox GL JS → Deferred (requires paid token for advanced features)
- Option C: Leaflet → Not chosen (raster-only, harder to style road networks with congestion overlays)

**Rationale:** MapLibre is the open-source fork of Mapbox GL JS and supports vector tiles, custom layer styling, and programmatic road-segment coloring needed for simulation overlays.

---

## D-007: Git Commit Style

**Date:** 2026-10-12  
**Decision:** Commits written as if by a developer (Alok Choudhary), not AI-generated boilerplate  
**Rationale:** User explicitly requested human-style commits. All commit messages use plain, descriptive English without AI attribution phrases.

---

## D-008: OpenStreetMap Road Network Ingestion Strategy

**Date:** 2026-10-13  
**Decision:** Fetch road network XML directly from official OSM API (`api.openstreetmap.org/api/0.6/map?bbox=...`) and parse with native `xml.etree.ElementTree` into NetworkX graph.  
**Options considered:**
- Option A: Overpass API via OSMnx `graph_from_bbox` → Failed with HTTP 429 / 504 gateway timeouts due to public Overpass server saturation and polygon query buffer overhead.
- Option B: Official OSM API 0.6 Map Endpoint → **CHOSEN**. Fast (1.83s for 3.5MB XML), reliable, official endpoint with zero third-party mirror dependency.

**Rationale:** Highly resilient, reproducible, requires no external C/C++ tools, and delivers clean bounding box road networks with 100% strongly connected components.

---

## D-009: Python 3.14 Windows AMD64 Binary Dependency Resolution

**Date:** 2026-10-13  
**Decision:** Pin `numpy==2.5.4`, `shapely==2.2.0`, and `pandas==3.0.6` to pre-built MSVC `win_amd64` binary wheels.  
**Options considered:**
- Option A: Legacy `numpy==2.2.5` → Source build failed requiring GCC >= 8.4 on Windows.
- Option B: `numpy==2.5.4` binary wheel → **CHOSEN**. Installs cleanly without local compilation or MSVC build tools.

