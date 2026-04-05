"""
Hunter.io Collector
===================
Enriches company profile with employee count, industry, and contact patterns.
Fires firmographic ICP signals.
"""
import logging

import httpx

from app.collectors.base import BaseCollector, CollectorResult
from app.config import settings

logger = logging.getLogger(__name__)

SWEET_SPOT_INDUSTRIES = {
    "telecommunications", "telecom", "telco", "internet service provider",
    "healthcare", "health care", "life sciences", "biotech", "pharmaceutical",
    "hospital", "medical",
    "financial services", "banking", "insurance", "fintech", "capital markets",
    "utilities", "energy", "oil and gas",
    "government", "public sector", "federal",
    "retail", "logistics", "supply chain",
    "manufacturing", "industrial",
    "media", "entertainment",
}

COMPETITOR_COMPANIES = {
    "databricks", "snowflake", "amazon", "google", "microsoft",
    "dremio", "denodo", "starburst", "cloudera", "hortonworks",
    "informatica", "talend", "tibco",
}


class HunterCollector(BaseCollector):
    SOURCE_NAME = "hunter"
    BASE_URL = "https://api.hunter.io/v2"

    async def collect(self, domain: str, **kwargs) -> CollectorResult:
        result = CollectorResult()
        company_name: str = kwargs.get("company_name", domain.split(".")[0])

        if not settings.hunter_api_key:
            result.add_error("Hunter.io API key not configured")
            # Try a lightweight fallback using Clearbit logo API to detect company
            await self._clearbit_fallback(domain, result)
            return result

        try:
            resp = await self._get(
                f"{self.BASE_URL}/domain-search",
                params={
                    "domain": domain,
                    "api_key": settings.hunter_api_key,
                    "limit": 5,
                },
            )
            data = resp.json().get("data", {})
            await self._process_hunter_data(data, domain, company_name, result)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                result.add_error("Hunter.io rate limit hit")
            else:
                result.add_error(f"Hunter.io API error: {e.response.status_code}")
        except Exception as e:
            result.add_error(f"Hunter.io error: {e}")
            logger.debug("Hunter error for %s: %s", domain, e)

        return result

    async def _process_hunter_data(
        self, data: dict, domain: str, company_name: str, result: CollectorResult
    ) -> None:
        """Process Hunter.io response and fire signals."""
        org = data.get("organization") or {}
        industry = (org.get("industry") or data.get("industry") or "").lower()
        employee_count = org.get("size") or data.get("employees")
        country = org.get("country") or data.get("country") or ""
        description = org.get("description") or data.get("description") or ""

        # Store metadata for profile enrichment
        result.metadata.update({
            "industry": industry,
            "employee_count": employee_count,
            "country": country,
            "description": description[:500] if description else "",
        })

        # Competitor check (anti-signal)
        company_lower = company_name.lower()
        for comp in COMPETITOR_COMPANIES:
            if comp in company_lower or comp in industry:
                result.add_signal(
                    signal_name="anti_is_competitor",
                    signal_tier=0,
                    signal_points=-10.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"Company '{company_name}' identified as a competitor ({comp})",
                    is_anti_signal=True,
                )
                return  # Don't bother with more analysis

        # Employee count signals
        if employee_count is not None:
            if employee_count < 50:
                result.add_signal(
                    signal_name="anti_too_small",
                    signal_tier=0,
                    signal_points=-10.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"Company has {employee_count} employees — too small for Zetaris",
                    is_anti_signal=True,
                )
            elif 500 <= employee_count <= 10000:
                result.add_signal(
                    signal_name="enterprise_employee_count",
                    signal_tier=2,
                    signal_points=5.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"Company has {employee_count} employees — mid-to-large enterprise sweet spot (500–10,000)",
                )
            elif employee_count > 10000:
                result.add_signal(
                    signal_name="enterprise_employee_count",
                    signal_tier=2,
                    signal_points=5.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"Large enterprise: {employee_count} employees",
                )

        # Industry sweet-spot signal
        if industry:
            matched_industry = next((ind for ind in SWEET_SPOT_INDUSTRIES if ind in industry), None)
            if matched_industry:
                result.add_signal(
                    signal_name="zetaris_target_industry",
                    signal_tier=2,
                    signal_points=5.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"Industry '{industry}' is a Zetaris sweet-spot vertical (telecom/healthcare/finserv/utilities)",
                )

    async def _clearbit_fallback(self, domain: str, result: CollectorResult) -> None:
        """Lightweight fallback using Clearbit's free logo API to at least confirm the company exists."""
        try:
            resp = await self._get(f"https://logo.clearbit.com/{domain}")
            result.metadata["clearbit_logo_found"] = resp.status_code == 200
        except Exception:
            pass
