"""
Urbynex - AI Copilot Orchestrator (M5.4 & M5.5).
Executes the controlled 13-step AI workflow:
Classify -> Retrieve Documents -> Tool Call -> Format Citations -> Enforce Groundedness.
Adheres strictly to Urbynex zero-fabrication principles.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.ai.document_processor import DocumentProcessor
from backend.ai.tools import ToolRegistry
from backend.ai.vector_store import HybridVectorStore
from backend.db.repository import RunRepository
from backend.simulation.network_loader import NetworkLoader

logger = logging.getLogger("urbynex.ai.copilot")


class AICopilotEngine:
    """Production AI Copilot for Urbynex Smart City Platform."""

    def __init__(
        self,
        docs_dir: Optional[Path] = None,
        repo: Optional[RunRepository] = None,
        loader: Optional[NetworkLoader] = None,
    ):
        self.docs_dir = docs_dir or (Path(__file__).resolve().parent.parent / "data" / "documents")
        self.repo = repo or RunRepository()
        self.loader = loader or NetworkLoader()
        self.vector_store = HybridVectorStore()
        self.tool_registry = ToolRegistry(
            repo=self.repo,
            loader=self.loader,
            vector_store=self.vector_store,
        )
        self.doc_processor = DocumentProcessor()
        self._index_initial_documents()

    def _index_initial_documents(self) -> int:
        """Indexes all planning documents in the documents folder."""
        total_chunks = 0
        if not self.docs_dir.exists():
            return total_chunks

        for fpath in self.docs_dir.glob("*.md"):
            try:
                chunks = self.doc_processor.process_file(fpath)
                added = self.vector_store.add_chunks(chunks)
                total_chunks += added
                logger.info(f"Indexed document '{fpath.name}': {added} chunks.")
            except Exception as e:
                logger.warning(f"Failed to index document {fpath}: {e}")

        for fpath in self.docs_dir.glob("*.txt"):
            try:
                chunks = self.doc_processor.process_file(fpath)
                added = self.vector_store.add_chunks(chunks)
                total_chunks += added
            except Exception as e:
                logger.warning(f"Failed to index document {fpath}: {e}")

        logger.info(f"AI Copilot vector store ready with {total_chunks} total chunks.")
        return total_chunks

    def ask(
        self,
        query: str,
        city_id: Optional[str] = None,
        user_id: str = "anonymous",
    ) -> Dict[str, Any]:
        """
        Processes a user question through the grounded retrieval and tool workflow.
        Returns response with citations, assumptions, and tool call audit summary.
        """
        q = query.strip()
        q_lower = q.lower()

        citations: List[str] = []
        retrieved_contexts: List[Dict[str, Any]] = []
        tools_executed: List[str] = []

        # 1. Check for Simulation Metric Query (e.g. run_id mentioned)
        words = q.split()
        run_ids = [w for w in words if len(w) == 36 and "-" in w]  # UUID-like pattern

        if ("metric" in q_lower or "simulation" in q_lower or "result" in q_lower) and run_ids:
            target_run_id = run_ids[0]
            tools_executed.append("get_simulation_metrics")
            tool_res = self.tool_registry.execute_tool(
                "get_simulation_metrics",
                {"run_id": target_run_id},
                user_id=user_id,
            )
            if "error" in tool_res:
                reply = f"Simulation Run `{target_run_id}`: {tool_res['error']}"
            else:
                m = tool_res.get("metrics", {})
                tt = m.get("avg_travel_time_s", {}).get("value", 0)
                completed = m.get("completed_trips", {}).get("value", 0)
                throughput = m.get("throughput_veh_per_hr", {}).get("value", 0)
                reply = (
                    f"**Simulation Run Summary (`{target_run_id}`)** `[SIMULATED]`:\n"
                    f"- Status: **{tool_res.get('status')}**\n"
                    f"- Completed Trips: **{completed:,}**\n"
                    f"- Average Travel Time: **{tt:.1f} seconds**\n"
                    f"- Network Throughput: **{throughput:,.1f} vehicles/hour**\n\n"
                    f"*All values are empirical outputs from the simulation engine.*"
                )
            return {
                "answer": reply,
                "citations": citations,
                "data_label": "SIMULATED",
                "tools_executed": tools_executed,
            }

        # 2. Check for Comparison Query
        if ("compare" in q_lower or "difference" in q_lower or "delta" in q_lower) and len(run_ids) >= 2:
            base_id, target_id = run_ids[0], run_ids[1]
            tools_executed.append("compare_scenarios")
            comp_res = self.tool_registry.execute_tool(
                "compare_scenarios",
                {"baseline_run_id": base_id, "target_run_id": target_id},
                user_id=user_id,
            )
            if "error" in comp_res:
                reply = f"Comparison failed: {comp_res['error']}"
            else:
                reply = (
                    f"**Scenario Comparison** `[SIMULATED]`:\n"
                    f"- Baseline: `{base_id}` vs Target: `{target_id}`\n"
                    f"- Classification: **{comp_res.get('overall_outcome', 'neutral')}**\n"
                    f"- Comparison metrics calculated over identical network topology."
                )
            return {
                "answer": reply,
                "citations": citations,
                "data_label": "SIMULATED",
                "tools_executed": tools_executed,
            }

        # 3. Document Retrieval over Master Plans & Guidelines
        matches = self.vector_store.search(query=q, city_id=city_id, top_k=3)

        if matches:
            tools_executed.append("search_city_documents")
            context_blocks = []
            for chunk, score in matches:
                cit = chunk.to_citation()
                if cit not in citations:
                    citations.append(cit)
                context_blocks.append(f"**{chunk.title}** ({chunk.section}):\n> {chunk.text}\n{cit}")
                retrieved_contexts.append({
                    "chunk_id": chunk.chunk_id,
                    "title": chunk.title,
                    "section": chunk.section,
                    "citation": cit,
                    "score": score,
                })

            reply_body = "\n\n".join(context_blocks)
            answer = (
                f"Based on indexed municipal planning documentation and traffic standards `[CITED DOCUMENT]`:\n\n"
                f"{reply_body}\n\n"
                f"**Citations:**\n" + "\n".join(f"- {c}" for c in citations)
            )
            return {
                "answer": answer,
                "citations": citations,
                "retrieved_contexts": retrieved_contexts,
                "data_label": "CITED_DOCUMENT",
                "tools_executed": tools_executed,
            }

        # 4. Fallback: Declare insufficient documentation rather than speculating
        return {
            "answer": (
                "I could not find sufficient evidence in the indexed municipal planning documents "
                "or simulation runs to answer this question accurately. Please verify your query or "
                "specify a target city (`jaipur`, `delhi`) or simulation run UUID."
            ),
            "citations": [],
            "data_label": "UNCERTAIN",
            "tools_executed": tools_executed,
        }
