"""
Urbynex - AI Copilot API Schemas.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CopilotChatRequest(BaseModel):
    query: str = Field(..., min_length=2, description="User question or instruction")
    city_id: Optional[str] = Field(default=None, description="Optional city filter, e.g. 'jaipur' or 'delhi'")
    session_id: Optional[str] = Field(default=None, description="Conversation session ID")


class CopilotChatResponse(BaseModel):
    answer: str
    citations: List[str] = Field(default_factory=list)
    data_label: str
    tools_executed: List[str] = Field(default_factory=list)
    retrieved_contexts: Optional[List[Dict[str, Any]]] = None


class ApprovedToolParam(BaseModel):
    type: str
    properties: Dict[str, Any]
    required: Optional[List[str]] = None


class ApprovedToolDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]


class ApprovedToolsListResponse(BaseModel):
    tools: List[ApprovedToolDefinition]
    total: int


class ToolAuditEntrySchema(BaseModel):
    timestamp: str
    user_id: str
    tool_name: str
    arguments: Dict[str, Any]
    authorized: bool
    status: str
    result_summary: str


class ToolAuditListResponse(BaseModel):
    entries: List[ToolAuditEntrySchema]
    total: int
