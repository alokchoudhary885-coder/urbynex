# Urbynex — System Architecture

## Overview

Urbynex is a full-stack web application with a clear separation between the frontend, backend API, simulation workers, data layer, and AI services.

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14)                │
│  Landing | City Explorer | Scenario Builder | Results       │
│  AI Copilot | Simulation Monitor | Comparison | Data Mgmt  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS / REST + SSE
┌─────────────────────────▼───────────────────────────────────┐
│                    BACKEND API (FastAPI)                     │
│  /cities  /networks  /scenarios  /runs  /compare  /ai       │
│  Auth middleware | Input validation | Authorization layer   │
└──────┬──────────────┬────────────────────┬──────────────────┘
       │              │                    │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────────▼──────────────────┐
│  SQLite DB  │ │Task Queue  │ │   AI Service Layer          │
│  (WAL mode) │ │(Celery+    │ │   Gemini API (Function      │
│  Users      │ │ Redis)     │ │   Calling) + RAG Engine     │
│  Scenarios  │ │            │ │   (LlamaIndex + ChromaDB)   │
│  Runs       │ └─────┬──────┘ └────────────────────────────┘
│  Metrics    │       │
│  Documents  │ ┌─────▼──────────────────────────────────────┐
└─────────────┘ │        SIMULATION WORKERS                  │
                │  Engine A: Graph Simulator (NetworkX-based)│
                │  Engine B: SUMO Adapter (optional)          │
                │  OSM Network Loader | Metric Extractor      │
                └─────────────────────────────────────────────┘
```

## Component Boundaries

### Frontend (`/frontend`)
- Next.js 14 App Router with TypeScript
- Tailwind CSS + Lucide icons
- MapLibre GL JS for interactive road-network map
- Recharts for simulation metric charts
- SWR for data fetching and cache invalidation
- NextAuth.js for authentication

### Backend API (`/backend/api`)
- FastAPI with Pydantic v2 validation
- JWT authentication middleware
- Role and workspace authorization on every endpoint
- Background job submission via Celery
- OpenAPI schema at `/docs`

### Simulation Workers (`/backend/simulation`)
- Common `SimulationEngine` interface (abstract base class)
- `GraphEngine`: Python-based, NetworkX graph, BPR travel time, queue model
- `SUMOEngine`: Optional adapter calling SUMO binary via subprocess
- `NetworkLoader`: OSMnx → internal graph format
- `MetricExtractor`: Parses engine output into standard metric schema

### Data Layer (`/backend/db`)
- SQLAlchemy ORM with Alembic migrations
- SQLite (WAL) for development
- PostgreSQL migration path for production
- ChromaDB for document vector embeddings

### AI Service (`/backend/ai`)
- Gemini API client with Function Calling
- Approved tool registry (whitelist-only)
- RAG pipeline: LlamaIndex ingestion + retrieval
- Prompt injection protection on retrieved document chunks
- Audit log for every AI tool execution

## Data Flow: Simulation Request

```
User → Scenario Builder → POST /runs → Celery task queued
→ Worker picks up task → Loads network → Generates demand
→ Runs engine → Extracts metrics → Saves to DB
→ Status: completed → Frontend polls → Displays results
```

## Data Flow: AI Copilot Request

```
User message → POST /ai/chat → Classify intent
→ Retrieve context (city, scenario, run_id)
→ Retrieve relevant documents (RAG)
→ LLM with Function Calling → Tool calls validated
→ Execute approved tools (run_simulation, get_metrics, compare)
→ Collect results → Generate grounded response with citations
→ Return to frontend with tool execution trace
```

## Security Boundaries

- AI tools: whitelist only, argument validation, user authorization checked before execution
- File uploads: type validation, size limits, content scanning
- Secrets: environment variables only, never in source control
- API: rate limiting on expensive endpoints (simulation, AI)
- Database: parameterized queries only via ORM

## Deployment Topology (Development)

```
localhost:3000  ←→  Next.js dev server
localhost:8000  ←→  FastAPI (uvicorn)
localhost:6379  ←→  Redis (Celery broker)
localhost:8000  ←→  SQLite (file-based, same process)
```

## Deployment Topology (Production Target)

- Containerized services via Docker Compose
- PostgreSQL replacing SQLite
- Redis for Celery and session cache
- Nginx reverse proxy
- Environment-based configuration

## Directory Structure

```
urbynex/
├── README.md
├── .gitignore
├── docs/                    ← All documentation
├── backend/
│   ├── api/                 ← FastAPI routes and middleware
│   ├── simulation/          ← Engine A, Engine B, network loader
│   ├── ai/                  ← Gemini client, RAG, tools
│   ├── db/                  ← Models, migrations, session
│   ├── data/
│   │   ├── networks/        ← Imported road networks
│   │   ├── documents/       ← Planning docs for RAG
│   │   └── simulations/     ← Run outputs and logs
│   ├── tests/               ← Backend unit and integration tests
│   └── requirements.txt
├── frontend/
│   ├── app/                 ← Next.js App Router pages
│   ├── components/          ← Reusable UI components
│   ├── lib/                 ← API client, hooks, utilities
│   └── package.json
├── scripts/                 ← Setup, data import, network prep
└── tests/                   ← End-to-end tests
```
