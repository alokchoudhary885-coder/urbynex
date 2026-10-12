# Urbynex — AI and RAG

## Philosophy

The AI Copilot must:
1. Use real simulation data, never invent metrics
2. Cite sources with document title and section when making factual claims
3. Declare uncertainty when evidence is insufficient
4. Execute only approved tools with validated arguments
5. Respect user authorization on every tool call
6. Never expose secrets, internal errors, or other users' data

---

## AI Model

**Provider:** Google Gemini API  
**Feature used:** Function Calling (structured tool execution)  
**Fallback:** If Gemini API unavailable, return "AI service temporarily unavailable" — do not fabricate a response

---

## Approved Tool Registry

These are the only tools the AI may call. All arguments are validated before execution.

| Tool | Description | Auth Required |
|---|---|---|
| `get_cities()` | List available cities and their status | Any logged-in user |
| `get_city_info(city_id)` | Get city metadata and network versions | Any logged-in user |
| `get_road_segments(city_id, network_version)` | List valid edge identifiers | Any logged-in user |
| `get_valid_edges(city_id, network_version, bbox)` | Edges within a bounding box | Any logged-in user |
| `search_city_documents(query, city_id)` | Semantic + keyword search over indexed docs | Workspace member |
| `validate_scenario(scenario_config)` | Validate a scenario config without running | Any logged-in user |
| `run_simulation(scenario_config)` | Submit a validated simulation job | Workspace member |
| `get_run_status(run_id)` | Check job status and progress | Run owner or admin |
| `get_simulation_metrics(run_id)` | Retrieve stored metrics | Run owner or admin |
| `compare_scenarios(baseline_id, target_id)` | Compare two compatible runs | Owns both runs or admin |
| `list_user_runs(limit)` | List user's recent simulation runs | Own runs only |

### Explicitly Forbidden
- Shell command execution
- Direct database queries
- File system access
- Reading environment variables or secrets
- Accessing other users' private data
- HTTP requests to external services (except via approved provider adapters)

---

## Tool Execution Audit Log

Every AI tool call is logged with:
- `user_id`
- `tool_name`
- `arguments` (sanitized — no secrets)
- `authorization_result`
- `execution_result`
- `timestamp`

Logs are stored in `ai_tool_audit` table and are not exposed to the user in full.

---

## Controlled AI Workflow

```
1. CLASSIFY: What is the user asking?
   → information | scenario_creation | result_analysis | document_retrieval | comparison

2. COLLECT CONTEXT: What city, scenario, run_id is the user referring to?

3. RETRIEVE DOCUMENTS (if relevant): Semantic + keyword search over indexed planning docs
   → Filter by workspace + city access

4. EXTRACT SCENARIO (if creation requested): Parse user intent into ScenarioConfig schema
   → Identify missing parameters → Ask user to clarify

5. VALIDATE: validate_scenario(config) → Fix errors or explain rejection

6. CONFIRM (for expensive actions): Show proposed simulation config → User confirms

7. EXECUTE: run_simulation(validated_config) → Returns run_id

8. MONITOR: get_run_status(run_id) → Wait for completion

9. RETRIEVE: get_simulation_metrics(run_id) → Actual stored data only

10. COMPARE (if requested): compare_scenarios(baseline_id, target_id)

11. INTERPRET: Generate explanation using actual metrics + retrieved documents

12. CITE: Attach document citations with title, date, section

13. RESPOND: Include assumptions, limitations, and data provenance labels
```

---

## RAG Pipeline

### Document Ingestion
1. Upload document (PDF, TXT, Markdown)
2. Validate file type and size (max 20MB)
3. Extract text (pdfplumber for PDF, direct for TXT/MD)
4. Split into chunks (500 tokens, 50-token overlap)
5. Attach metadata: document_id, title, city, section, page number, access_level
6. Generate embeddings (Gemini text-embedding-004 or equivalent)
7. Store in ChromaDB with metadata filters
8. Update document index record in SQLite

### Retrieval
1. User query → generate query embedding
2. Semantic search: top-K chunks by cosine similarity
3. Keyword search: BM25 over chunk text
4. Merge results, deduplicate, re-rank
5. Filter: user workspace access + city filter
6. Return top chunks with source metadata

### Citation Format
```
[Source: Jaipur Comprehensive Mobility Plan 2019, Chapter 4: Traffic Operations, p. 47]
```

If no adequate evidence is found:
> "I could not find sufficient evidence in the available documents to support this claim. The following is based on general traffic engineering knowledge, not cited documentation."

---

## Prompt Injection Protection

Retrieved document chunks are:
1. Wrapped in an explicit "RETRIEVED DOCUMENT" delimiter
2. The system prompt instructs the model that document content cannot override system rules
3. Tool argument validation happens in Python code, independent of model output
4. Authorization checks run before every tool execution, regardless of what the model requests

---

## Groundedness Rules

The AI Copilot must:
- State metric values only from `get_simulation_metrics()` output
- Never generate example simulation numbers to illustrate a point
- Explicitly label AI-generated interpretation with "Analysis:" or "Interpretation:"
- Explicitly label cited data with "According to [run_id]:" or "[Source: document]"
- Say "I don't know" or "insufficient data" rather than speculate
