# Urbynex — Simulation Model

## Overview

Urbynex supports two simulation engines behind a common interface.

---

## Engine A: Lightweight Graph-Based Simulator

### Purpose
Rapid experiments, local development, and environments where SUMO is unavailable.

### Assumptions (Explicit)

1. **Road capacity** is derived as `lanes × 1800 vehicles/hour/lane` when no measured data is available. 1800 veh/hr/lane is a standard urban planning approximation (HCM-based) but is not calibrated to Jaipur or Delhi conditions.

2. **Default speed** is 40 km/h where OSM `maxspeed` is absent. This may over- or underestimate free-flow speed for specific corridors.

3. **Lane counts** default to 1 where OSM `lanes` is absent. This underestimates capacity for wide arterials.

4. **BPR Travel Time Function:**
   ```
   t(v) = t0 × (1 + α × (v/c)^β)
   ```
   Where:
   - `t0` = free-flow travel time (length / free_flow_speed)
   - `v` = current volume (vehicles/hour)
   - `c` = edge capacity (vehicles/hour)
   - `α` = 0.15 (BPR standard)
   - `β` = 4 (BPR standard)
   
   These parameters are standard BPR defaults and are not calibrated to local conditions.

5. **Route assignment** uses shortest path (Dijkstra). This is a static assignment approach. Real traffic uses dynamic route choice behavior.

6. **No lane-changing, car-following, or gap-acceptance models.** This is a macroscopic/mesoscopic simplified approach.

7. **Signal timing** is not modeled unless explicit signal data is provided. Without signal data, intersection delay is not computed.

8. **Queue spillback** is approximated via congestion penalty on BPR; it is not a detailed queue simulation.

9. **Vehicle types** are uniform (passenger car equivalent) unless separate vehicle classes are explicitly modeled.

### Supported Metrics
| Metric | Available | Notes |
|---|---|---|
| Completed trips | ✅ | Count of vehicles that reached destination |
| Average travel time | ✅ | Mean across completed trips |
| Average waiting time | ⚠️ | Estimated from BPR delay; not measured |
| Average distance | ✅ | Mean route length |
| Throughput | ✅ | Vehicles completing trip per hour |
| Active vehicles | ✅ | Vehicles in network at simulation end |
| Queue length | ⚠️ | Approximated; not spatially explicit |
| Routing failures | ✅ | Vehicles with no valid path |
| Simulation duration | ✅ | Wall-clock time |

### Limitations
- Not validated against measured Jaipur or Delhi traffic data
- BPR parameters are defaults, not locally calibrated
- Does not model pedestrians, cyclists, or public transport
- Signal modeling requires additional network preparation
- Queue spillback is approximate only

---

## Engine B: SUMO Adapter

### Purpose
More detailed traffic simulation when SUMO binary is installed and a validated network is available.

### Requirements
- SUMO installed and on system PATH
- Compatible SUMO version: 1.18+ (to be verified during Phase 3)
- SUMO network file (`.net.xml`) prepared from OSM via `netconvert`

### Capabilities (when available)
- Microscopic car-following simulation
- Lane-changing behavior
- Traffic signal simulation with detailed phase control
- Detailed per-vehicle statistics via `tripinfo` output
- Edge-level statistics via `edgedata` output
- Queue detection via `queueOutput`

### Adapter Responsibilities
- Convert Urbynex scenario config to SUMO config files
- Invoke SUMO via subprocess with timeout
- Parse SUMO XML output files
- Map SUMO statistics to Urbynex metric schema
- Handle SUMO binary not found, network validation failures, timeout

### Status
Phase 3 target. Engine A is the primary engine for Phase 1 and Phase 2.

---

## Common Engine Interface

```python
class SimulationEngine(ABC):
    @property
    @abstractmethod
    def engine_id(self) -> str: ...

    @abstractmethod
    def validate_scenario(self, config: ScenarioConfig) -> ValidationResult: ...

    @abstractmethod
    def run(self, config: ScenarioConfig) -> SimulationResult: ...

    @abstractmethod
    def get_capabilities(self) -> EngineCapabilities: ...
```

Every run result includes `engine_id`, `engine_version`, and `assumptions` to identify what was used and what was assumed.

---

## Scenario Type Support Matrix

| Scenario | Engine A | Engine B |
|---|---|---|
| Baseline synthetic demand | ✅ | ✅ (Phase 3) |
| Demand change (±%) | ✅ | ✅ (Phase 3) |
| Road closure | ✅ | ✅ (Phase 3) |
| Signal timing change | ⚠️ Network-dependent | ✅ With SUMO signal data |
| Traffic incident | ✅ (capacity reduction) | ✅ (Phase 3) |
| Live-informed scenario | ✅ (uses observed speeds) | ✅ (Phase 3) |

---

## Reproducibility

Every simulation run records:
- `random_seed`: used for demand generation and stochastic elements
- `engine_id` and `engine_version`
- `network_version`: network file hash or version identifier
- `scenario_config`: complete parameter snapshot
- `simulation_timestamp`: when the run executed

Re-running with the same `random_seed`, `engine_id`, `network_version`, and `scenario_config` must produce identical results for Engine A.
