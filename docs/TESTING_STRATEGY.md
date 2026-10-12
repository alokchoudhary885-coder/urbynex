# Urbynex — Testing Strategy

## Principles

1. Tests are written alongside implementation, not added at the end
2. Phase 1 requires deterministic tests on a known test network
3. Every simulation metric must be verifiable from test output
4. Tests must not mock the simulation engine during correctness tests

---

## Test Types

### 1. Unit Tests (backend/tests/unit/)
- Individual functions and classes in isolation
- Use pytest
- Deterministic: no random behavior unless seed is fixed
- Examples: BPR function, demand generator, metric calculator, comparison logic

### 2. Integration Tests (backend/tests/integration/)
- Multiple components working together
- Run on real (small) test network
- Examples: full simulation run on test network, metric persistence, run comparison

### 3. API Tests (backend/tests/api/)
- FastAPI endpoints via TestClient
- Include auth, validation, error handling
- Examples: POST /runs returns 202, GET /runs/{id}/metrics returns correct format

### 4. End-to-End Tests (tests/e2e/)
- Full workflow from HTTP request to database and back
- Phase 7 target

---

## Test Network

A 5-node, 6-edge test network with known properties:

```
A ──── B ──── C
       │
       D ──── E
```

- All edges: 1km, 1 lane, 40 km/h, capacity 1800 veh/hr
- A→C: path via B (2km)
- A→C alternative: not available (tests rerouting via D→E is not a shortcut)
- Closing B→C forces all A→C traffic through a longer route (deterministic expectation)

### Test Assertions
| Test | Expected |
|---|---|
| Baseline 100 vehicles A→C: all complete | completed_trips = 100 |
| Close B→C edge: travel time increases | avg_travel_time > baseline |
| Same seed twice: identical metrics | deterministic |
| 120 vehicles vs 100 vehicles: avg travel time higher | monotonic demand-congestion |
| No path scenario: routing failures > 0 | handled gracefully |

---

## Test Coverage Targets

| Module | Target Coverage |
|---|---|
| simulation/engines/graph_engine.py | ≥ 85% |
| simulation/network_loader.py | ≥ 80% |
| simulation/comparison.py | ≥ 90% |
| db/models.py + repositories | ≥ 75% |
| api/ routes | ≥ 70% |
| ai/ tools | ≥ 80% |

---

## Running Tests

```bash
# From backend/ directory with venv active
pytest tests/ -v --tb=short

# With coverage
pytest tests/ --cov=. --cov-report=term-missing
```

---

## What Is Not Tested (and Why)

| Item | Reason |
|---|---|
| SUMO execution accuracy | Requires SUMO installation; validated in Phase 3 separately |
| Live traffic provider responses | Cannot test without real API keys; use mock adapter |
| Gemini API responses | Use recorded fixtures for deterministic testing |
| OSM API availability | Network import is cached; tested against saved fixture |
