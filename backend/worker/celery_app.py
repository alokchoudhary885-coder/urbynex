"""
backend/worker/celery_app.py

Celery application factory for Urbynex background job processing.

Architecture:
    - Broker:  Redis (redis://localhost:6379/0) — primary
    - Backend: Redis (redis://localhost:6379/1) — result store
    - Fallback: When Redis is unavailable, simulations run synchronously
      in the FastAPI request via the existing BackgroundTasks path.
      This keeps development working without a running Redis server.

Production deployment (Phase 7):
    - Set REDIS_URL env var to point to a real Redis instance or Redis Cluster.
    - Run: celery -A backend.worker.celery_app worker --loglevel=info --concurrency=4
"""

import os
import logging

from celery import Celery
from celery.utils.log import get_task_logger

logger = logging.getLogger("urbynex.worker")
task_logger = get_task_logger("urbynex.tasks")

# ---------------------------------------------------------------------------
# Broker / Backend configuration
# ---------------------------------------------------------------------------
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RESULT_BACKEND: str = os.getenv("REDIS_RESULT_URL", "redis://localhost:6379/1")

celery_app = Celery(
    "urbynex",
    broker=REDIS_URL,
    backend=RESULT_BACKEND,
    include=["backend.worker.tasks"],
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Result expiry: keep results for 24 hours
    result_expires=86400,

    # Task acknowledgement — acknowledge only after task completes
    # so that a worker crash doesn't silently lose a job
    task_acks_late=True,
    task_reject_on_worker_lost=True,

    # Concurrency hint for the worker process (overridable via CLI)
    worker_concurrency=int(os.getenv("CELERY_CONCURRENCY", "2")),

    # Maximum memory per child before restart (prevents memory leaks over long runs)
    worker_max_memory_per_child=512_000,  # 512 MB in KB

    # Routing: all simulation tasks go to the "simulations" queue
    task_routes={
        "backend.worker.tasks.run_simulation_task": {"queue": "simulations"},
    },

    # Default queue
    task_default_queue="simulations",

    # Soft/hard time limits per task
    task_soft_time_limit=300,   # 5 minutes → raises SoftTimeLimitExceeded
    task_time_limit=360,        # 6 minutes → kills task process

    # Retry policy defaults
    task_max_retries=2,
    task_default_retry_delay=10,  # seconds
)


def is_redis_available() -> bool:
    """
    Checks whether the configured Redis broker is reachable.
    Used to decide between Celery async dispatch and in-process fallback.
    Performs a single PING with a short timeout — does NOT raise.
    """
    try:
        import redis as redis_lib  # type: ignore
        client = redis_lib.Redis.from_url(REDIS_URL, socket_connect_timeout=1)
        return client.ping()
    except Exception:
        return False
