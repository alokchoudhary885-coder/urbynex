# Urbynex — Known Limitations

This document records known limitations, missing features, and unresolved assumptions. It is maintained honestly throughout development.

Last updated: 2026-10-12

---

## Simulation Engine A (Graph Simulator)

| Limitation | Impact | Mitigation |
|---|---|---|
| BPR parameters (α=0.15, β=4) are standard defaults, not calibrated | Travel time estimates are approximations | Document clearly; do not present as validated outputs |
| Default speed 40 km/h where OSM maxspeed is absent | May over/underestimate free-flow speed | Allow user to override per network import |
| Default lane count 1 where OSM lanes is absent | Underestimates capacity on wide roads | Flag edges with assumed values in network metadata |
| Static route assignment (no dynamic re-routing mid-simulation) | Does not capture driver response to real-time congestion | Acknowledged in UI and metric tooltips |
| No signal model without explicit signal data | Cannot evaluate signal timing scenarios on most OSM networks | Block signal timing scenario type unless signal data is available |
| Queue spillback approximated via BPR congestion | Not a spatial queue model | Clearly labeled as "estimated" |
| No car-following or lane-change models | Microscopic behavior not captured | Use Engine B (SUMO) for microscopic needs |

## Road Network Data

| Limitation | Impact | Mitigation |
|---|---|---|
| OSM data reflects volunteer mapping, not official surveys | Some road attributes may be wrong or missing | Validate connectivity and flag missing attributes |
| Signal timing data rarely available in OSM India | Signal timing experiments blocked | Acquire separate signal data or acknowledge limitation |
| Network covers only selected corridor, not whole city | Cannot represent city-wide traffic redistribution | Be explicit about geographic scope in UI |
| Capacity values are derived, not measured | Congestion estimates are approximate | Label as estimated capacity |

## AI Copilot

| Limitation | Impact | Mitigation |
|---|---|---|
| Gemini API rate limits | AI responses may be delayed or throttled | Implement retry with exponential backoff; inform user |
| RAG quality depends on document availability | If relevant docs not indexed, AI cites general knowledge | Clearly distinguish cited vs general statements |
| Function Calling may misinterpret ambiguous requests | Wrong tool call | Require user confirmation before simulation submission |
| AI explanations are interpretive, not engineering certification | Must not be used for real infrastructure decisions | Prominent disclaimer in UI |

## Data

| Limitation | Impact | Mitigation |
|---|---|---|
| No live traffic provider configured by default | Cannot show real-time traffic | Show clear "unavailable" state; synthetic fills the gap |
| Historical data requires user upload | No built-in historical dataset | Provide example CSV template |
| Planning documents must be obtained and verified | RAG knowledge base starts empty | Phase 5 focuses on this; document which sources are indexed |

## Phase-Specific Pending Items

| Item | Target Phase |
|---|---|
| SUMO integration and validation | Phase 3 |
| Delhi road network | Phase 4 |
| Live traffic provider adapters | Phase 4 |
| Signal timing with actual signal data | Phase 3+ |
| Multi-user authorization at scale | Phase 7 |
| PostgreSQL migration | Phase 7 |
| End-to-end tests | Phase 7 |
| Production deployment | Phase 7 |
