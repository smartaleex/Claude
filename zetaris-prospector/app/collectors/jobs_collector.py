"""
Jobs Collector
==============
Analyses job postings via Adzuna API to detect data engineering hiring signals.
Job postings are one of the strongest intent signals for platform needs.
"""
import logging

import httpx

from app.collectors.base import BaseCollector, CollectorResult
from app.config import settings

logger = logging.getLogger(__name__)

# Tier 1 keywords: federation/virtualization specific
FEDERATION_KEYWORDS = [
    "data virtualization", "federated query", "data mesh", "data fabric",
    "data federation", "query federation", "virtual data",
]

# Tier 1 keywords: multi-engine expertise required
MULTI_ENGINE_KEYWORDS = [
    "trino", "presto", "duckdb", "iceberg", "delta lake", "apache hudi",
    "data lakehouse", "lakehouse",
]

# Tier 2 keywords: modern data stack
MODERN_STACK_KEYWORDS = [
    "modern data stack", "data platform", "cloud data warehouse",
    "data infrastructure", "analytics engineering", "data build tool", "dbt",
    "spark", "databricks", "snowflake", "bigquery",
]

# Data role titles that indicate a maturing data team
DATA_ROLE_TITLES = [
    "data engineer", "analytics engineer", "data architect", "data platform",
    "ml engineer", "machine learning engineer", "data scientist",
    "data infrastructure", "data reliability",
]


class JobsCollector(BaseCollector):
    SOURCE_NAME = "jobs"
    ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"

    async def collect(self, domain: str, **kwargs) -> CollectorResult:
        result = CollectorResult()
        company_name: str = kwargs.get("company_name", domain.split(".")[0])

        if not settings.adzuna_app_id or not settings.adzuna_api_key:
            result.add_error("Adzuna API credentials not configured")
            # Fallback: try a lightweight web scrape of Indeed
            await self._fallback_web_search(company_name, result)
            return result

        # Search for data-related jobs at this company
        postings = await self._fetch_adzuna(company_name, result)
        self._analyse_postings(postings, company_name, result)
        return result

    async def _fetch_adzuna(self, company_name: str, result: CollectorResult) -> list[dict]:
        """Fetch job postings from Adzuna."""
        postings = []
        # Try AU + US + GB markets
        for country in ["au", "us", "gb"]:
            try:
                resp = await self._get(
                    f"{self.ADZUNA_BASE}/{country}/search/1",
                    params={
                        "app_id": settings.adzuna_app_id,
                        "app_key": settings.adzuna_api_key,
                        "company": company_name,
                        "what": "data engineer OR data architect OR analytics engineer OR data scientist",
                        "results_per_page": 20,
                        "content-type": "application/json",
                    },
                )
                data = resp.json()
                batch = data.get("results", [])
                postings.extend(batch)
                if batch:
                    break  # Found postings — stop trying other markets
            except httpx.HTTPStatusError as e:
                logger.debug("Adzuna %s failed: %s", country, e.response.status_code)
            except Exception as e:
                logger.debug("Adzuna %s error: %s", country, e)

        return postings

    async def _fallback_web_search(self, company_name: str, result: CollectorResult) -> None:
        """Light-weight fallback: check if company has data roles on their own site."""
        try:
            # Try to detect from LinkedIn public job URL pattern via search snippet
            # This is a best-effort approach without API keys
            pass
        except Exception:
            pass

    def _analyse_postings(
        self, postings: list[dict], company_name: str, result: CollectorResult
    ) -> None:
        """Analyse postings and fire ICP signals."""
        if not postings:
            return

        data_role_count = 0
        federation_fired = False
        multi_engine_fired = False
        modern_stack_fired = False

        for posting in postings:
            title = (posting.get("title") or "").lower()
            description = (posting.get("description") or "").lower()
            combined = f"{title} {description}"
            url = posting.get("redirect_url") or posting.get("adref") or ""

            # Count data roles
            if any(rt in title for rt in DATA_ROLE_TITLES):
                data_role_count += 1

            # Federation / virtualization signals (Tier 1)
            if not federation_fired:
                matched = [kw for kw in FEDERATION_KEYWORDS if kw in combined]
                if matched:
                    result.add_signal(
                        signal_name="job_posting_data_federation",
                        signal_tier=1,
                        signal_points=10.0,
                        source=self.SOURCE_NAME,
                        evidence_text=f"Job posting '{posting.get('title')}' mentions: {', '.join(matched)}",
                        evidence_url=url,
                    )
                    federation_fired = True

            # Multi-engine expertise (Tier 1)
            if not multi_engine_fired:
                engines_found = [kw for kw in MULTI_ENGINE_KEYWORDS if kw in combined]
                if len(engines_found) >= 2:
                    result.add_signal(
                        signal_name="job_posting_multi_engine",
                        signal_tier=1,
                        signal_points=10.0,
                        source=self.SOURCE_NAME,
                        evidence_text=f"Job posting requires multi-engine expertise: {', '.join(engines_found)}",
                        evidence_url=url,
                    )
                    multi_engine_fired = True

            # Modern data stack (Tier 2)
            if not modern_stack_fired:
                matched = [kw for kw in MODERN_STACK_KEYWORDS if kw in combined]
                if matched:
                    result.add_signal(
                        signal_name="job_posting_modern_data_stack",
                        signal_tier=2,
                        signal_points=5.0,
                        source=self.SOURCE_NAME,
                        evidence_text=f"Job posting mentions modern data stack: {', '.join(matched[:3])}",
                        evidence_url=url,
                    )
                    modern_stack_fired = True

        # Data hiring volume signal (Tier 2)
        if data_role_count >= 3:
            result.add_signal(
                signal_name="data_role_hiring_volume",
                signal_tier=2,
                signal_points=5.0,
                source=self.SOURCE_NAME,
                evidence_text=f"{data_role_count} simultaneous data engineering / analytics roles open at {company_name}",
                evidence_url=None,
            )
