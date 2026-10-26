"""
backend/worker/__init__.py

Celery worker package for Urbynex background job processing.
"""

from .celery_app import celery_app

__all__ = ["celery_app"]
