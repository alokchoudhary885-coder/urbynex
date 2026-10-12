# Urbynex — API Contracts

## Base URL

Development: `http://localhost:8000/api/v1`  
All responses: `application/json`  
Authentication: `Authorization: Bearer <JWT>` (except public endpoints)

---

## Authentication

### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "Alok Choudhary"
}
```

**Response 201:**
```json
{ "user_id": "uuid", "email": "user@example.com", "name": "Alok Choudhary" }
```

**Errors:** 400 (validation), 409 (email exists)

---

### POST /auth/login
Authenticate and receive a JWT.

**Request:**
```json
{ "email": "user@example.com", "password": "SecurePassword123!" }
```

**Response 200:**
```json
{ "access_token": "jwt_string", "token_type": "bearer", "expires_in": 3600 }
```

---

## Cities

### GET /cities
List all supported cities.

**Response 200:**
```json
{
  "cities": [
    {
      "city_id": "jaipur",
      "name": "Jaipur",
      "country": "India",
      "status": "network_ready",
      "networks_available": 1,
      "description": "MI Road and JLN Marg corridor"
    }
  ]
}
```

**City status values:** `planned` | `importing` | `validation_failed` | `network_ready`

---

### GET /cities/{city_id}/networks
List available road network versions for a city.

**Response 200:**
```json
{
  "networks": [
    {
      "network_id": "jaipur_v1",
      "city_id": "jaipur",
      "version": "v1",
      "description": "MI Road - JLN Marg corridor",
      "bbox": { "north": 26.935, "south": 26.915, "east": 75.840, "west": 75.820 },
      "node_count": 142,
      "edge_count": 387,
      "source": "OpenStreetMap",
      "imported_at": "2026-10-12T22:00:00Z",
      "validation_status": "passed",
      "validation_notes": "All nodes reachable, no missing length attributes"
    }
  ]
}
```

---

### GET /cities/{city_id}/networks/{network_id}/edges
List edge identifiers in the network (used for scenario config validation).

**Query params:** `bbox` (optional: north,south,east,west)  
**Response 200:**
```json
{
  "edges": [
    { "edge_id": "123456789", "name": "MI Road", "length_m": 450, "speed_kmh": 50, "lanes": 3 }
  ],
  "total": 387
}
```

---

## Scenarios

### POST /scenarios
Create a new scenario.

**Request:**
```json
{
  "name": "Baseline Morning Peak",
  "description": "Synthetic demand, morning peak, no interventions",
  "city_id": "jaipur",
  "network_id": "jaipur_v1",
  "scenario_type": "baseline",
  "demand": {
    "vehicle_count": 500,
    "duration_seconds": 3600,
    "start_hour": 8,
    "demand_profile": "morning_peak",
    "seed": 42
  },
  "interventions": []
}
```

**Response 201:**
```json
{ "scenario_id": "uuid", "name": "Baseline Morning Peak", "created_at": "..." }
```

**Scenario types:** `baseline` | `demand_change` | `road_closure` | `signal_timing` | `incident` | `live_informed`

---

### GET /scenarios/{scenario_id}
Retrieve a scenario definition.

---

## Simulation Runs

### POST /runs
Submit a simulation job.

**Request:**
```json
{
  "scenario_id": "uuid",
  "engine": "graph_engine_v1"
}
```

**Response 202:**
```json
{ "run_id": "uuid", "status": "queued", "submitted_at": "..." }
```

**Run status values:** `queued` | `running` | `completed` | `failed` | `cancelled`

---

### GET /runs/{run_id}
Get run status and metadata.

**Response 200:**
```json
{
  "run_id": "uuid",
  "scenario_id": "uuid",
  "status": "completed",
  "engine": "graph_engine_v1",
  "network_id": "jaipur_v1",
  "seed": 42,
  "queued_at": "...",
  "started_at": "...",
  "completed_at": "...",
  "error": null
}
```

---

### GET /runs/{run_id}/metrics
Retrieve stored simulation metrics.

**Response 200:**
```json
{
  "run_id": "uuid",
  "status": "completed",
  "metrics": {
    "completed_trips": { "value": 487, "unit": "vehicles", "available": true },
    "avg_travel_time_s": { "value": 342.5, "unit": "seconds", "available": true },
    "avg_waiting_time_s": { "value": 45.2, "unit": "seconds", "available": true },
    "avg_distance_m": { "value": 1240.0, "unit": "meters", "available": true },
    "throughput_veh_per_hr": { "value": 487, "unit": "vehicles/hour", "available": true },
    "active_vehicles": { "value": 13, "unit": "vehicles", "available": true },
    "routing_failures": { "value": 0, "unit": "vehicles", "available": true },
    "simulation_duration_s": { "value": 3600, "unit": "seconds", "available": true }
  },
  "engine": "graph_engine_v1",
  "assumptions": [
    "Default speed 40 km/h applied to 23 edges with missing maxspeed",
    "Default lane count 1 applied to 45 edges with missing lanes data",
    "BPR parameters: alpha=0.15, beta=4 (standard defaults, not locally calibrated)"
  ],
  "data_label": "SIMULATED"
}
```

---

### DELETE /runs/{run_id}
Cancel a queued or running job.

**Response 200:** `{ "status": "cancelled" }`  
**Errors:** 409 (already completed), 403 (not owner)

---

## Comparison

### POST /compare
Compare two compatible simulation runs.

**Request:**
```json
{ "baseline_run_id": "uuid", "target_run_id": "uuid" }
```

**Response 200:**
```json
{
  "compatible": true,
  "compatibility_warnings": [],
  "metrics": [
    {
      "name": "avg_travel_time_s",
      "baseline": 342.5,
      "target": 398.2,
      "absolute_diff": 55.7,
      "percent_diff": 16.3,
      "direction": "worse",
      "unit": "seconds",
      "interpretation": "Average travel time increased by 55.7 seconds (+16.3%), indicating greater congestion under 20% higher demand."
    }
  ]
}
```

---

## AI Copilot

### POST /ai/chat
Send a message to the AI Copilot.

**Request:**
```json
{
  "message": "Compare the baseline with the 20% demand scenario",
  "context": {
    "city_id": "jaipur",
    "active_run_id": "uuid",
    "baseline_run_id": "uuid"
  },
  "conversation_id": "uuid"
}
```

**Response 200:**
```json
{
  "response": "Based on run uuid vs baseline run uuid: average travel time increased by 55.7 seconds (+16.3%)...",
  "tool_calls_executed": [
    { "tool": "get_simulation_metrics", "run_id": "uuid", "status": "success" },
    { "tool": "compare_scenarios", "status": "success" }
  ],
  "sources": [
    { "document": "Jaipur Comprehensive Mobility Plan", "section": "Chapter 4", "relevance": "corridor capacity" }
  ],
  "data_labels": ["SIMULATED", "AI INTERPRETATION"],
  "assumptions": ["Engine A BPR model used", "Standard default speeds applied to 23 edges"]
}
```

---

## Error Format

All errors follow this format:
```json
{
  "error": "validation_error",
  "message": "vehicle_count must be between 1 and 10000",
  "field": "demand.vehicle_count",
  "request_id": "uuid"
}
```

Internal server errors return `500` with a generic message — stack traces are never exposed.
