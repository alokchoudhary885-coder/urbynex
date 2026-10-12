# Urbynex — Data Sources

## Principles

1. Every data value displayed must have an identified source
2. Clearly distinguish: SYNTHETIC | HISTORICAL | OBSERVED | SIMULATED | AI INTERPRETATION
3. Never fabricate API responses, live readings, or document citations
4. Record retrieval timestamp and observation timestamp separately where available

---

## 1. Road Network Data

**Source:** OpenStreetMap (OSM)  
**License:** Open Database License (ODbL) — attribution required  
**Access Method:** osmnx Python library  
**Coverage:** Any city with OSM road data  

### Attributes Used
| Attribute | OSM Tag | Fallback |
|---|---|---|
| Road length | `length` (computed) | Required |
| Speed limit | `maxspeed` | 40 km/h (urban default) |
| Lanes | `lanes` | 1 |
| Road type | `highway` | Required |
| One-way | `oneway` | False |
| Traffic signals | `highway=traffic_signals` | Not available |

### Known Gaps
- Signal timing data is rarely in OSM
- Lane counts are often missing for secondary roads
- Capacity values are derived, not measured
- OSM data reflects volunteers' mapping, not official road surveys

### Networks Planned
| City | Area | Status |
|---|---|---|
| Jaipur | MI Road–JLN Marg corridor (~2km×2km) | Phase 1 |
| Delhi | Connaught Place–Barakhamba corridor | Phase 4 |

---

## 2. Synthetic Traffic Data

**Source:** Generated internally by `SyntheticDemandGenerator`  
**Label:** Always shown as `[SYNTHETIC]`  

### Parameters
- `vehicle_count`: Total vehicles to simulate
- `duration_seconds`: Simulation time window
- `start_hour`: Departure distribution center (e.g., 8 for morning peak)
- `demand_profile`: `uniform` | `morning_peak` | `evening_peak`
- `seed`: Random seed for reproducibility
- `vehicle_mix`: Proportion of car/truck/motorcycle (where supported)

### Guarantee
The same `seed` + same parameters always produce the same demand set.

---

## 3. Historical Traffic Data (Import)

**Source:** User-uploaded CSV or JSON  
**Label:** `[HISTORICAL]`  

### Supported CSV Schema
```
timestamp, edge_id, speed_kmh, volume_veh_per_hr, occupancy_pct
2024-01-15T08:00:00+05:30, 123456789, 32.5, 850, 0.45
```

### Supported JSON Schema
```json
{
  "source": "manual_survey",
  "period": "2024-01-15",
  "observations": [
    {
      "timestamp": "2024-01-15T08:00:00+05:30",
      "edge_id": "123456789",
      "speed_kmh": 32.5,
      "volume_veh_per_hr": 850
    }
  ]
}
```

### Validation Rules
- `timestamp`: ISO 8601 required
- `edge_id`: Must match a known edge in the selected network (or flagged as unmapped)
- `speed_kmh`: 0–200 range
- `volume_veh_per_hr`: ≥ 0
- Duplicate `(timestamp, edge_id)` pairs: first occurrence kept, duplicates logged

---

## 4. Live Traffic Data (Provider Adapters)

**Label:** `[OBSERVED]`  
**Status:** Phase 4 — adapter framework only in Phase 2

### Potential Providers
| Provider | Product | India Coverage | Status |
|---|---|---|---|
| TomTom | Traffic Flow API | Available | Planned — requires API key |
| Google Maps | Routes API / Roads API | Available | Planned — requires API key |
| Mapbox | Traffic Plugin | Limited | Planned |
| HERE | Traffic API | Available | Under evaluation |

### Handling Unavailable State
When no provider is configured or credentials are missing:
- Show "Live data unavailable" badge
- Platform remains fully functional via synthetic simulation
- No fake live readings are shown

### Storage
```
live_observations:
  - provider: str
  - edge_id: str
  - speed_kmh: float | null
  - volume_estimate: int | null
  - retrieved_at: datetime  ← when we fetched from API
  - observed_at: datetime   ← timestamp from provider
  - confidence: float | null
```

---

## 5. Planning Documents (RAG Knowledge Base)

**Source:** Publicly available planning documents  
**Label:** Always cited with document title, date, and section  

### Candidate Documents (to be verified before use)
| Document | Publisher | Relevance | Status |
|---|---|---|---|
| Jaipur Master Plan 2025 | JDA (Jaipur Development Authority) | Road network, transport corridors | To be obtained and verified |
| Jaipur Comprehensive Mobility Plan | UMTC / JMC | Modal split, traffic volumes | To be obtained |
| Delhi Master Plan 2041 | DDA | City-level transport | To be obtained |
| IRC:106-1990 Geometric Design Standards | Indian Roads Congress | Capacity standards | To be obtained |
| SUMO Documentation | Eclipse Foundation | Simulation methodology | Available online |

**Note:** No document is indexed until its source, publication date, and relevant sections are verified.
