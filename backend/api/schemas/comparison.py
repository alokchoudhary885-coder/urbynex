"""
backend/api/schemas/comparison.py

Pydantic schemas for side-by-side scenario run comparisons.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from ...simulation.comparison import MetricComparisonItem


class ComparisonRequest(BaseModel):
    """Payload to compare two completed simulation runs."""
    baseline_run_id: str = Field(description="Run ID of the baseline reference simulation")
    target_run_id: str = Field(description="Run ID of the intervention simulation to compare against baseline")


class ComparisonResponse(BaseModel):
    """Side-by-side delta metrics, classifications, and summary verdict."""
    baseline_run_id: str
    target_run_id: str
    compatible: bool
    compatibility_warnings: List[str] = Field(default_factory=list)
    metrics: List[MetricComparisonItem]
    summary_verdict: str
