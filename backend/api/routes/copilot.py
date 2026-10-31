"""
backend/api/routes/copilot.py

FastAPI router for AI Copilot chat, document grounded RAG retrieval,
approved tool definitions, and tool audit trail.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from ..dependencies import get_repository, get_network_loader
from ...ai.copilot import AICopilotEngine
from ...db.repository import RunRepository
from ...simulation.network_loader import NetworkLoader
from ..schemas.copilot import (
    ApprovedToolDefinition,
    ApprovedToolsListResponse,
    CopilotChatRequest,
    CopilotChatResponse,
    ToolAuditEntrySchema,
    ToolAuditListResponse,
)

router = APIRouter(prefix="/ai", tags=["AI Copilot & RAG Engine"])

# Lazy singleton engine instance
_copilot_engine: Optional[AICopilotEngine] = None


def get_copilot_engine(
    repo: RunRepository = Depends(get_repository),
    loader: NetworkLoader = Depends(get_network_loader),
) -> AICopilotEngine:
    global _copilot_engine
    if _copilot_engine is None:
        _copilot_engine = AICopilotEngine(repo=repo, loader=loader)
    return _copilot_engine


@router.post("/chat", response_model=CopilotChatResponse)
def chat_with_copilot(
    req: CopilotChatRequest,
    engine: AICopilotEngine = Depends(get_copilot_engine),
) -> CopilotChatResponse:
    """
    Engages the Urbynex AI Copilot.
    Grounds answers in official indexed city mobility documents and verified simulation runs.
    Appends full citations and data provenance labels. Never fabricates metric values.
    """
    res = engine.ask(query=req.query, city_id=req.city_id)
    return CopilotChatResponse(
        answer=res["answer"],
        citations=res.get("citations", []),
        data_label=res.get("data_label", "UNCERTAIN"),
        tools_executed=res.get("tools_executed", []),
        retrieved_contexts=res.get("retrieved_contexts"),
    )


@router.get("/tools", response_model=ApprovedToolsListResponse)
def list_approved_tools(
    engine: AICopilotEngine = Depends(get_copilot_engine),
) -> ApprovedToolsListResponse:
    """
    Lists the restricted, audited set of approved simulation and query tools
    that the AI Copilot is authorized to call via function calling.
    """
    tool_defs = engine.tool_registry.get_tool_definitions()
    items = [
        ApprovedToolDefinition(
            name=t["name"],
            description=t["description"],
            parameters=t["parameters"],
        )
        for t in tool_defs
    ]
    return ApprovedToolsListResponse(tools=items, total=len(items))


@router.get("/audit", response_model=ToolAuditListResponse)
def get_tool_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    engine: AICopilotEngine = Depends(get_copilot_engine),
) -> ToolAuditListResponse:
    """
    Returns recent AI tool execution audit logs to verify safety, authorization, and parameters.
    """
    recent = engine.tool_registry.audit_log[-limit:]
    items = [
        ToolAuditEntrySchema(
            timestamp=e.timestamp,
            user_id=e.user_id,
            tool_name=e.tool_name,
            arguments=e.arguments,
            authorized=e.authorized,
            status=e.status,
            result_summary=e.result_summary,
        )
        for e in recent
    ]
    return ToolAuditListResponse(entries=items, total=len(items))
