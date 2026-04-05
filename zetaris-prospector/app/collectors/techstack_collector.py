"""
Tech Stack Collector
====================
Detects data and cloud technologies from a company's website.
Uses python-Wappalyzer (no API key needed) + optional DetectZeStack API.
"""
import asyncio
import logging
from urllib.parse import urlparse

import httpx

from app.collectors.base import BaseCollector, CollectorResult
from app.config import settings

logger = logging.getLogger(__name__)

# Data warehouse fingerprints (detected via JS, headers, or subdomains)
DATA_WAREHOUSES = {
    "Snowflake": ["snowflake", "snowflakecomputing"],
    "Databricks": ["databricks"],
    "Amazon Redshift": ["redshift", "amazonaws"],
    "Google BigQuery": ["bigquery", "googleapis"],
    "Azure Synapse": ["synapse", "azure"],
    "Firebolt": ["firebolt"],
    "ClickHouse": ["clickhouse"],
}

BI_TOOLS = {
    "Tableau": ["tableau"],
    "Power BI": ["powerbi", "power-bi", "microsoftbi"],
    "Looker": ["looker"],
    "Metabase": ["metabase"],
    "Mode": ["modeanalytics"],
    "Domo": ["domo"],
}

CLOUD_PROVIDERS = {
    "AWS": ["amazonaws", "cloudfront", "awsstatic"],
    "Azure": ["azure", "microsoftonline", "azureedge"],
    "GCP": ["googleapis", "googlecloud", "gstatic"],
}

COMPETITOR_TOOLS = {
    "Denodo": ["denodo"],
    "Dremio": ["dremio"],
    "Starburst": ["starburst"],
}


class TechStackCollector(BaseCollector):
    SOURCE_NAME = "techstack"

    async def collect(self, domain: str, **kwargs) -> CollectorResult:
        result = CollectorResult()
        url = f"https://{domain}"

        # Try Wappalyzer if available
        wappalyzer_result = await self._run_wappalyzer(url, result)

        # Detect via HTTP headers/content
        header_result = await self._detect_via_http(url, domain, result)

        # Optional: DetectZeStack API
        if settings.detectzestack_api_key:
            await self._run_detectzestack(domain, result)

        # Analyse all detected technologies
        all_detected = result.metadata.get("detected_technologies", [])
        await self._analyse_technologies(all_detected, domain, result)

        return result

    async def _run_wappalyzer(self, url: str, result: CollectorResult) -> bool:
        """Run python-Wappalyzer analysis (no API key required)."""
        try:
            # Wappalyzer is synchronous — run in thread pool
            loop = asyncio.get_event_loop()
            techs = await loop.run_in_executor(None, self._wappalyzer_sync, url)
            if techs:
                existing = result.metadata.get("detected_technologies", [])
                result.metadata["detected_technologies"] = existing + techs
                result.metadata["wappalyzer_ran"] = True
                return True
        except Exception as e:
            logger.debug("Wappalyzer failed for %s: %s", url, e)
            result.add_error(f"Wappalyzer unavailable: {e}")
        return False

    @staticmethod
    def _wappalyzer_sync(url: str) -> list[str]:
        """Synchronous Wappalyzer call (runs in executor)."""
        try:
            from Wappalyzer import Wappalyzer, WebPage
            wappalyzer = Wappalyzer.latest()
            webpage = WebPage.new_from_url(url, timeout=10)
            techs = list(wappalyzer.analyze(webpage))
            return [t.lower() for t in techs]
        except ImportError:
            return []
        except Exception:
            return []

    async def _detect_via_http(self, url: str, domain: str, result: CollectorResult) -> bool:
        """Lightweight HTTP-based tech detection via headers and response content."""
        detected = []
        try:
            resp = await self._get(url)
            headers_str = " ".join(f"{k}:{v}" for k, v in resp.headers.items()).lower()
            content = resp.text.lower()[:50000]  # First 50KB

            combined = headers_str + " " + content

            # Check for cloud provider signals in headers/content
            for provider, keywords in CLOUD_PROVIDERS.items():
                if any(kw in combined for kw in keywords):
                    detected.append(provider.lower())

            # Check for BI tools
            for tool, keywords in BI_TOOLS.items():
                if any(kw in combined for kw in keywords):
                    detected.append(tool.lower())

            # Check careers page for modern data stack mentions
            careers_url = f"https://{domain}/careers"
            await self._check_careers_page(careers_url, result)

        except Exception as e:
            logger.debug("HTTP detection failed for %s: %s", url, e)

        existing = result.metadata.get("detected_technologies", [])
        result.metadata["detected_technologies"] = existing + detected
        return bool(detected)

    async def _check_careers_page(self, url: str, result: CollectorResult) -> None:
        """Scan the careers page for data platform language."""
        try:
            resp = await self._get(url)
            text = resp.text.lower()
            keywords = [
                "data platform", "modern data stack", "analytics engineering",
                "data mesh", "data fabric", "data lake", "data warehouse",
                "federated", "data virtualization",
            ]
            found = [kw for kw in keywords if kw in text]
            if found:
                result.add_signal(
                    signal_name="careers_page_data_platform_mention",
                    signal_tier=3,
                    signal_points=2.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"Careers page mentions: {', '.join(found)}",
                    evidence_url=url,
                )
        except Exception:
            pass  # Careers page often 404s — not an error

    async def _run_detectzestack(self, domain: str, result: CollectorResult) -> None:
        """Optional DetectZeStack API call for DNS/TLS tech detection."""
        try:
            resp = await self._get(
                "https://api.detectzestack.com/v1/analyze",
                params={"domain": domain, "api_key": settings.detectzestack_api_key},
            )
            data = resp.json()
            techs = [t.get("name", "").lower() for t in data.get("technologies", [])]
            existing = result.metadata.get("detected_technologies", [])
            result.metadata["detected_technologies"] = existing + techs
        except Exception as e:
            logger.debug("DetectZeStack failed for %s: %s", domain, e)

    async def _analyse_technologies(
        self, technologies: list[str], domain: str, result: CollectorResult
    ) -> None:
        """Analyse the combined list of detected technologies and fire signals."""
        tech_set = {t.lower() for t in technologies}
        tech_str = ", ".join(sorted(tech_set))

        # Detect competing data warehouses
        detected_dws = []
        for dw_name, keywords in DATA_WAREHOUSES.items():
            if any(kw in tech_set for kw in keywords):
                detected_dws.append(dw_name)

        if len(detected_dws) >= 2:
            result.add_signal(
                signal_name="multi_data_warehouse_stack",
                signal_tier=1,
                signal_points=10.0,
                source=self.SOURCE_NAME,
                evidence_text=f"Detected multiple competing data warehouses on {domain}: {', '.join(detected_dws)}",
                evidence_url=f"https://{domain}",
            )
        elif len(detected_dws) == 1:
            # Single DW — anti-signal only if nothing else
            result.add_signal(
                signal_name="anti_single_cloud_dw",
                signal_tier=0,
                signal_points=-10.0,
                source=self.SOURCE_NAME,
                evidence_text=f"Only a single data warehouse detected ({detected_dws[0]}) — limited federation pain",
                evidence_url=f"https://{domain}",
                is_anti_signal=True,
            )

        # BI tool signal
        detected_bi = [tool for tool, kws in BI_TOOLS.items() if any(kw in tech_set for kw in kws)]
        if detected_bi:
            result.add_signal(
                signal_name="bi_tooling_detected",
                signal_tier=2,
                signal_points=5.0,
                source=self.SOURCE_NAME,
                evidence_text=f"BI tools detected: {', '.join(detected_bi)} — unified data source needed",
                evidence_url=f"https://{domain}",
            )

        # Azure signal (Zetaris has Azure Marketplace listing)
        if any(kw in tech_set for kw in CLOUD_PROVIDERS["Azure"]):
            result.add_signal(
                signal_name="azure_cloud_detected",
                signal_tier=2,
                signal_points=5.0,
                source=self.SOURCE_NAME,
                evidence_text="Azure cloud detected — Zetaris has a native Azure Marketplace listing",
                evidence_url=f"https://{domain}",
            )

        # Multi-cloud signal
        clouds_present = [
            cloud for cloud, kws in CLOUD_PROVIDERS.items()
            if any(kw in tech_set for kw in kws)
        ]
        if len(clouds_present) >= 2:
            result.add_signal(
                signal_name="multi_cloud_detected",
                signal_tier=3,
                signal_points=2.0,
                source=self.SOURCE_NAME,
                evidence_text=f"Multi-cloud environment detected: {', '.join(clouds_present)}",
                evidence_url=f"https://{domain}",
            )

        # Competitor tool detection (anti-signal)
        for comp, kws in COMPETITOR_TOOLS.items():
            if any(kw in tech_set for kw in kws):
                result.add_signal(
                    signal_name="anti_known_competitor_customer",
                    signal_tier=0,
                    signal_points=-10.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"Competitor tool detected on website: {comp}",
                    evidence_url=f"https://{domain}",
                    is_anti_signal=True,
                )

        result.metadata["detected_dws"] = detected_dws
        result.metadata["detected_bi"] = detected_bi
        result.metadata["detected_clouds"] = clouds_present
