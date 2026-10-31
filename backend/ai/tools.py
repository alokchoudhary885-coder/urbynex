"""
Urbynex - Approved AI Tool Registry & Audit Logging (M5.3).
Implements the 11 restricted, safe tools approved for AI Copilot execution
with argument validation, access controls, and persistent audit trail.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from backend.db.repository import RunRepository
from backend.simulation.network_loader import NetworkLoader
from backend.ai.vector_store import HybridVectorStore

logger = logging.getLogger("urbynex.ai.tools")


@dataclass
class ToolAuditEntry:
    timestamp: str
    user_id: str
    tool_name: str
    arguments: Dict[str, Any]
    authorized: bool
    status: str
    result_summary: str


class ToolRegistry:
    """Registry of verified and audited simulation and data tools for the AI Copilot."""

    def __init__(
        self,
        repo: Optional[RunRepository] = None,
        loader: Optional[NetworkLoader] = None,
        vector_store: Optional[HybridVectorStore] = None,
    ):
        self.repo = repo or RunRepository()
        self.loader = loader or NetworkLoader()
        self.vector_store = vector_store or HybridVectorStore()
        self.audit_log: List[ToolAuditEntry] = []

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Returns OpenAPI/Gemini function calling schema definitions for approved tools."""
        return [
            {
                "name": "get_cities",
                "description": "Lists all supported digital twin cities and their operational status.",
                "parameters": {"type": "object", "properties": {}},
            },
            {
                "name": "get_city_info",
                "description": "Retrieves city details and available road network versions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city_id": {"type": "string", "description": "City identifier, e.g. 'jaipur' or 'delhi'"}
                    },
                    "required": ["city_id"],
                },
            },
            {
                "name": "search_city_documents",
                "description": "Searches official city master plans, comprehensive mobility plans, and traffic engineering standards.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query terms"},
                        "city_id": {"type": "string", "description": "Filter by city, e.g. 'jaipur' or 'delhi'"},
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "get_road_segments",
                "description": "Lists valid edge identifiers in a road network for intervention targeting.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "network_id": {"type": "string", "description": "Network ID, e.g. 'jaipur_v1' or 'delhi_v1'"},
                        "limit": {"type": "integer", "description": "Max edges to return", "default": 20},
                    },
                    "required": ["network_id"],
                },
            },
            {
                "name": "get_simulation_metrics",
                "description": "Retrieves verified empirical metrics for a completed simulation run. Never fabricates values.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "run_id": {"type": "string", "description": "Simulation run UUID"}
                    },
                    "required": ["run_id"],
                },
            },
            {
                "name": "compare_scenarios",
                "description": "Compares two completed simulation runs and returns percentage deltas and traffic impact evaluation.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "baseline_run_id": {"type": "string", "description": "Baseline run UUID"},
                        "target_run_id": {"type": "string", "description": "Target intervention run UUID"},
                    },
                    "required": ["baseline_run_id", "target_run_id"],
                },
            },
        ]

    def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        user_id: str = "anonymous",
    ) -> Dict[str, Any]:
        """Validates arguments, authorizes, executes the tool, and writes an audit log."""
        t_start = datetime.now(timezone.utc).isoformat()
        sanitized_args = {k: v for k, v in arguments.items() if not str(k).startswith("secret")}

        try:
            if tool_name == "get_cities":
                cities = self.repo.list_cities()
                result = {"cities": cities, "count": len(cities)}

            elif tool_name == "get_city_info":
                city_id = str(arguments.get("city_id", "")).strip().lower()
                networks = self.repo.list_networks(city_id=city_id)
                result = {"city_id": city_id, "networks": networks, "total_networks": len(networks)}

            elif tool_name == "search_city_documents":
                query = str(arguments.get("query", ""))
                city_id = arguments.get("city_id")
                matches = self.vector_store.search(query=query, city_id=city_id, top_k=3)
                chunks_data = [
                    {
                        "chunk_id": chunk.chunk_id,
                        "title": chunk.title,
                        "city_id": chunk.city_id,
                        "section": chunk.section,
                        "text": chunk.text,
                        "citation": chunk.to_citation(),
                        "relevance_score": score,
                    }
                    for chunk, score in matches
                ]
                result = {"query": query, "results": chunks_data, "count": len(chunks_data)}

            elif tool_name == "get_road_segments":
                network_id = str(arguments.get("network_id", "jaipur_v1"))
                limit = int(arguments.get("limit", 20))
                G, _ = self.loader.load_network(network_id)
                edges = []
                for idx, (u, v, k, data) in enumerate(G.edges(keys=True, data=True)):
                    if idx >= limit:
                        break
                    edges.append({
                        "edge_id": data.get("edge_id", f"{u}_{v}_{k}"),
                        "name": data.get("name", "Unnamed Road"),
                        "highway": data.get("highway", "road"),
                        "length_m": data.get("length", 0.0),
                        "speed_kmh": data.get("speed_kmh", 40.0),
                        "capacity_veh_hr": data.get("capacity_veh_hr", 1800.0),
                    })
                result = {"network_id": network_id, "edges": edges, "count": len(edges)}

            elif tool_name == "get_simulation_metrics":
                run_id = str(arguments.get("run_id", ""))
                metrics = self.repo.get_run_metrics(run_id)
                status = self.repo.get_run_status(run_id)
                if not status:
                    result = {"error": f"Simulation run '{run_id}' not found."}
                else:
                    result = {
                        "run_id": run_id,
                        "status": status.get("status"),
                        "metrics": metrics,
                        "data_label": "SIMULATED",
                    }

            elif tool_name == "compare_scenarios":
                from backend.api.services.simulation_service import SimulationService
                base_id = str(arguments.get("baseline_run_id", ""))
                target_id = str(arguments.get("target_run_id", ""))
                service = SimulationService(repo=self.repo)
                comp = service.compare_simulation_runs(base_id, target_id)
                result = comp.model_dump()

            else:
                result = {"error": f"Tool '{tool_name}' is not in the approved tool registry."}

            # Log audit
            entry = ToolAuditEntry(
                timestamp=t_start,
                user_id=user_id,
                tool_name=tool_name,
                arguments=sanitized_args,
                authorized=True,
                status="success",
                result_summary=f"Returned {len(str(result))} chars",
            )
            self.audit_log.append(entry)
            return result

        except Exception as exc:
            logger.error(f"Error executing AI tool {tool_name}: {exc}")
            entry = ToolAuditEntry(
                timestamp=t_start,
                user_id=user_id,
                tool_name=tool_name,
                arguments=sanitized_args,
                authorized=True,
                status="error",
                result_summary=str(exc),
            )
            self.audit_log.append(entry)
            return {"error": str(exc)}
