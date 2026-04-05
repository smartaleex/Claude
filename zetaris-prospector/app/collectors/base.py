"""
Base Collector
==============
Abstract base class for all data source adapters.
Provides shared httpx client, tenacity retry logic, and rate-limit helpers.
"""
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger(__name__)

RETRY_EXCEPTIONS = (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError)


def build_retry_decorator(max_attempts: int = 3, min_wait: float = 1.0, max_wait: float = 8.0):
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type(RETRY_EXCEPTIONS),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )


class CollectorResult:
    """Container for what a collector returns."""
    def __init__(self):
        self.signals: list[dict[str, Any]] = []
        self.metadata: dict[str, Any] = {}
        self.errors: list[str] = []

    def add_signal(
        self,
        signal_name: str,
        signal_tier: int,
        signal_points: float,
        source: str,
        evidence_text: str = "",
        evidence_url: str | None = None,
        is_anti_signal: bool = False,
    ) -> None:
        self.signals.append({
            "signal_name": signal_name,
            "signal_tier": signal_tier,
            "signal_points": signal_points,
            "source": source,
            "evidence_text": evidence_text[:1000] if evidence_text else "",
            "evidence_url": evidence_url,
            "is_anti_signal": is_anti_signal,
            "is_manual": False,
        })

    def add_error(self, error: str) -> None:
        self.errors.append(error)
        logger.warning("Collector error: %s", error)


class BaseCollector(ABC):
    """Abstract base for all data collectors."""

    SOURCE_NAME: str = "base"
    DEFAULT_TIMEOUT: float = 15.0

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.DEFAULT_TIMEOUT),
                headers={"User-Agent": "ZetarisProspector/1.0 (+https://zetaris.com)"},
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    @abstractmethod
    async def collect(self, domain: str, **kwargs) -> CollectorResult:
        """Run data collection for a given company domain. Always returns CollectorResult."""
        ...

    async def _get(self, url: str, params: dict | None = None, headers: dict | None = None) -> httpx.Response:
        client = await self._get_client()
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response

    @staticmethod
    async def _rate_sleep(seconds: float) -> None:
        """Simple cooperative sleep for rate limiting."""
        await asyncio.sleep(seconds)
