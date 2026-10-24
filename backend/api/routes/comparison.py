"""
backend/api/routes/comparison.py

Endpoint for comparing two completed simulation runs.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from ..dependencies import get_repository, get_simulation_engine
from ..schemas.comparison import ComparisonRequest, ComparisonResponse
from ..services.simulation_service import SimulationService
from ...db.repository import RunRepository
from ...simulation.engines.graph_engine import GraphEngine

router = APIRouter(tags=["Scenario Comparison"])


def get_comparison_service(
    repo: RunRepository = Depends(get_repository),
    engine: GraphEngine = Depends(get_simulation_engine),
) -> SimulationService:
    return SimulationService(repo=repo, engine=engine)


@router.post("/compare", response_model=ComparisonResponse)
def compare_runs(
    req: ComparisonRequest,
    service: SimulationService = Depends(get_comparison_service),
) -> ComparisonResponse:
    """
    Compares two completed simulation runs using actual execution results.
    Computes absolute and percentage deltas, classifies improvements vs deteriorations,
    and returns an executive narrative summary verdict.
    """
    try:
        comparison_res = service.compare_simulation_runs(
            baseline_run_id=req.baseline_run_id,
            target_run_id=req.target_run_id,
        )
        return ComparisonResponse(
            baseline_run_id=comparison_res.baseline_run_id,
            target_run_id=comparison_res.target_run_id,
            compatible=comparison_res.compatible,
            compatibility_warnings=comparison_res.compatibility_warnings,
            metrics=comparison_res.metrics,
            summary_verdict=comparison_res.summary_verdict,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
