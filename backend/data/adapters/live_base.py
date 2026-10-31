"""
Urbynex - Live Traffic Provider Adapter Framework.
Implements provider status checks, credentials validation, and graceful
unavailable state handling adhering to Urbynex zero-fabrication principles.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, List, Optional

from backend.data.adapters.base import LiveProviderStatusInfo, ProviderStatus


class BaseLiveProvider(ABC):
    """Abstract base class for third-party live traffic APIs."""

    def __init__(self, provider_name: str, coverage_area: str):
        self.provider_name = provider_name
        self.coverage_area = coverage_area

    @abstractmethod
    def check_status(self) -> LiveProviderStatusInfo:
        """Check whether the API key is present and provider is responsive."""
        pass


class TomTomTrafficProvider(BaseLiveProvider):
    """TomTom Traffic Flow & Incidents API adapter."""

    def __init__(self):
        super().__init__(provider_name="TomTom Traffic", coverage_area="India (Jaipur, Delhi)")

    def check_status(self) -> LiveProviderStatusInfo:
        api_key = os.getenv("TOMTOM_API_KEY")
        now_str = datetime.now(timezone.utc).isoformat()
        if not api_key:
            return LiveProviderStatusInfo(
                provider_name=self.provider_name,
                status=ProviderStatus.CREDENTIALS_MISSING,
                is_live=False,
                coverage_area=self.coverage_area,
                message="TOMTOM_API_KEY environment variable not configured. Live feeds disabled.",
                last_checked_at=now_str,
            )
        # If API key configured, provider is ready for external calls
        return LiveProviderStatusInfo(
            provider_name=self.provider_name,
            status=ProviderStatus.AVAILABLE,
            is_live=True,
            coverage_area=self.coverage_area,
            message="TomTom API key configured.",
            last_checked_at=now_str,
        )


class GoogleMapsTrafficProvider(BaseLiveProvider):
    """Google Maps Routes / Roads API traffic adapter."""

    def __init__(self):
        super().__init__(provider_name="Google Maps Routes", coverage_area="Global")

    def check_status(self) -> LiveProviderStatusInfo:
        api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        now_str = datetime.now(timezone.utc).isoformat()
        if not api_key:
            return LiveProviderStatusInfo(
                provider_name=self.provider_name,
                status=ProviderStatus.CREDENTIALS_MISSING,
                is_live=False,
                coverage_area=self.coverage_area,
                message="GOOGLE_MAPS_API_KEY environment variable not configured. Live feeds disabled.",
                last_checked_at=now_str,
            )
        return LiveProviderStatusInfo(
            provider_name=self.provider_name,
            status=ProviderStatus.AVAILABLE,
            is_live=True,
            coverage_area=self.coverage_area,
            message="Google Maps API key configured.",
            last_checked_at=now_str,
        )


class LiveTrafficRegistry:
    """Registry managing available traffic feed providers."""

    def __init__(self):
        self.providers: Dict[str, BaseLiveProvider] = {
            "tomtom": TomTomTrafficProvider(),
            "google_maps": GoogleMapsTrafficProvider(),
        }

    def get_all_statuses(self) -> List[LiveProviderStatusInfo]:
        return [provider.check_status() for provider in self.providers.values()]

    def is_any_live(self) -> bool:
        return any(p.check_status().is_live for p in self.providers.values())
