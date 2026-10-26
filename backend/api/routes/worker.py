"""
backend/api/routes/worker.py

Worker status endpoint — reports Celery/Redis connectivity and queue info.
This is a diagnostic/operational endpoint, not user-facing.
"""

from fastapi import APIRouter

router = APIRouter(tags=["Worker Status"])


@router.get("/worker/status", summary="Check Celery worker and Redis broker status")
def get_worker_status() -> dict:
    """
    Reports whether Redis is reachable and Celery workers are active.
    Used by health checks and the deployment runbook to confirm job queue availability.

    Returns:
        redis_available: bool — whether the broker can be pinged
        celery_workers:  list — active worker hostnames (empty if Redis unavailable)
        dispatch_mode:   str  — 'celery' or 'background_task_fallback'
        broker_url:      str  — Redis URL with credentials redacted
    """
    try:
        from ...worker.celery_app import celery_app, is_redis_available, REDIS_URL

        redis_ok = is_redis_available()

        workers: list = []
        if redis_ok:
            try:
                inspect = celery_app.control.inspect(timeout=2.0)
                active = inspect.active()
                if active:
                    workers = list(active.keys())
            except Exception:
                pass

        # Redact credentials from broker URL for safe display
        import re
        safe_url = re.sub(r"(redis://)([^@]+@)?", r"\1***@", REDIS_URL)

        return {
            "redis_available": redis_ok,
            "celery_workers": workers,
            "dispatch_mode": "celery" if redis_ok else "background_task_fallback",
            "broker_url": safe_url,
        }
    except Exception as exc:
        return {
            "redis_available": False,
            "celery_workers": [],
            "dispatch_mode": "background_task_fallback",
            "broker_url": "unavailable",
            "error": str(exc),
        }
