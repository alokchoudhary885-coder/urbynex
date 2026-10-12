# Urbynex — Simulate Cities. Predict Possibilities.

Urbynex is an AI-powered multi-city smart city digital twin and traffic simulation platform. It lets users explore real road networks, run traffic simulations, test infrastructure interventions, compare outcomes, and use AI to interpret results with supporting evidence.

---

## What Urbynex Does

- Explore real OpenStreetMap road networks for supported cities (Jaipur, Delhi)
- Generate synthetic traffic demand and run genuine traffic simulations
- Test scenarios: baseline, demand changes, road closures, signal timing, incidents
- Compare simulation runs with quantified metric differences
- Ask the AI Copilot to explain results, grounded in actual simulation data and planning documents
- Import historical traffic data and connect to live traffic providers

## What Urbynex Does Not Do

- It does not show fake or random traffic numbers
- It does not claim simulations predict the real world with certainty
- It does not invent document citations or fabricate API responses
- It does not replace professional traffic engineering assessment

---

## Project Status

**Current Phase:** Phase 0 — Planning and Environment Setup  
See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the full roadmap.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.14 + FastAPI |
| Traffic Simulation | Lightweight Graph Simulator + SUMO adapter |
| Road Networks | OpenStreetMap via OSMnx |
| Database | SQLite (WAL) → PostgreSQL migration path |
| Task Queue | Celery + Redis |
| AI / LLM | Gemini API with Function Calling |
| RAG | LlamaIndex + ChromaDB |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Maps | MapLibre GL JS |
| Charts | Recharts |
| Auth | NextAuth.js |

---

## Quick Start

> Setup instructions will be added after Phase 1 milestone is complete.

---

## Documentation

- [Project Vision](docs/PROJECT_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Data Sources](docs/DATA_SOURCES.md)
- [Simulation Model](docs/SIMULATION_MODEL.md)
- [AI and RAG](docs/AI_AND_RAG.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)
- [Known Limitations](docs/KNOWN_LIMITATIONS.md)
- [Decisions Log](docs/DECISIONS.md)

---

## License

MIT License. Road network data sourced from OpenStreetMap contributors under the Open Database License (ODbL).
