"""
backend/tests/unit/test_copilot.py

Unit tests for AI Copilot, DocumentProcessor, HybridVectorStore,
approved tool registry, and groundedness citation guarantees (M5.1 - M5.5).
"""
import pytest
from pathlib import Path
from backend.ai.document_processor import DocumentProcessor, DocumentChunk
from backend.ai.vector_store import HybridVectorStore
from backend.ai.tools import ToolRegistry
from backend.ai.copilot import AICopilotEngine


def test_document_processor_markdown_sections():
    proc = DocumentProcessor(target_chunk_words=100, overlap_words=20)
    sample_md = """# City Transport Plan 2025
## Section 1: Traffic Demand
The city has experienced significant growth along arterial corridors.
Private vehicles constitute 65% of all motorized trips.

## Section 2: Speed Limits
Speed limits on primary roads are capped at 50 km/h.
Residential streets are restricted to 30 km/h.
"""
    chunks = proc.process_text(sample_md, doc_id="test_plan", city_id="jaipur")

    assert len(chunks) >= 2
    assert chunks[0].document_id == "test_plan"
    assert chunks[0].city_id == "jaipur"
    assert chunks[0].title == "City Transport Plan 2025"
    assert "Traffic Demand" in chunks[0].section or "Speed Limits" in chunks[1].section
    assert "[Source: City Transport Plan 2025" in chunks[0].to_citation()


def test_hybrid_vector_store_retrieval_and_filtering():
    store = HybridVectorStore()
    chunk_jaipur = DocumentChunk(
        chunk_id="c1",
        document_id="jaipur_doc",
        title="Jaipur CMP",
        city_id="jaipur",
        section="Corridor Speed",
        text="Design speeds on MI Road are set at 50 km/h with high bus transit frequency.",
        chunk_index=0,
    )
    chunk_delhi = DocumentChunk(
        chunk_id="c2",
        document_id="delhi_doc",
        title="Delhi Master Plan",
        city_id="delhi",
        section="Connaught Place",
        text="Connaught Place Outer Circle carries 90,000 PCU daily with radial avenues.",
        chunk_index=0,
    )
    store.add_chunks([chunk_jaipur, chunk_delhi])

    # Search with query targeting Jaipur
    res_jaipur = store.search("MI Road speed", city_id="jaipur", top_k=2)
    assert len(res_jaipur) >= 1
    assert res_jaipur[0][0].chunk_id == "c1"

    # Search with query targeting Delhi
    res_delhi = store.search("Connaught Place Outer Circle", city_id="delhi", top_k=2)
    assert len(res_delhi) >= 1
    assert res_delhi[0][0].chunk_id == "c2"

    # Filter prevents leakage across cities
    leak_test = store.search("Connaught Place", city_id="jaipur", top_k=2)
    assert len(leak_test) == 0


def test_tool_registry_execution_and_audit():
    registry = ToolRegistry()
    res = registry.execute_tool("get_cities", {}, user_id="user_test_123")

    assert "cities" in res
    assert len(registry.audit_log) == 1
    audit = registry.audit_log[0]
    assert audit.tool_name == "get_cities"
    assert audit.user_id == "user_test_123"
    assert audit.status == "success"


def test_copilot_grounded_answer_with_citations():
    engine = AICopilotEngine()
    # Query regarding Jaipur CMP
    ans_jaipur = engine.ask("What is the peak hour factor in Jaipur according to the mobility plan?")
    assert ans_jaipur["data_label"] == "CITED_DOCUMENT"
    assert len(ans_jaipur["citations"]) >= 1
    assert "Jaipur Comprehensive Mobility Plan" in ans_jaipur["answer"]
    assert "search_city_documents" in ans_jaipur["tools_executed"]

    # Query regarding Delhi Connaught Place
    ans_delhi = engine.ask("What are the speed limits and volume on Connaught Place in Delhi?")
    assert ans_delhi["data_label"] == "CITED_DOCUMENT"
    assert len(ans_delhi["citations"]) >= 1
    assert "Delhi Master Plan" in ans_delhi["answer"]


def test_copilot_fallback_on_unsupported_query():
    engine = AICopilotEngine()
    # Completely unrelated question
    ans = engine.ask("What is the weather on Mars today?")
    assert ans["data_label"] == "UNCERTAIN"
    assert len(ans["citations"]) == 0
    assert "sufficient evidence" in ans["answer"].lower()
