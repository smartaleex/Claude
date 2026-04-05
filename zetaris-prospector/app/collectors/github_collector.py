"""
GitHub Collector
================
Scans a company's GitHub organisation for data engineering signals.
High-value Tier 1 and Tier 2 signals come from this source.
"""
import logging
from datetime import datetime, timedelta

import httpx

from app.collectors.base import BaseCollector, CollectorResult
from app.config import settings

logger = logging.getLogger(__name__)

# Technology topics/keywords that signal data lakehouse needs
LAKEHOUSE_TECH = {
    "iceberg", "delta-lake", "delta_lake", "apache-iceberg",
    "hudi", "apache-hudi", "trino", "prestodb", "presto",
    "duckdb", "lakehouse",
}
QUERY_ENGINE_TECH = {
    "spark", "apache-spark", "pyspark", "flink", "apache-flink",
}
DBT_TECH = {"dbt", "dbt-core", "data-build-tool"}
MODERN_STACK = {
    "data-mesh", "data-fabric", "data-virtualization",
    "data-platform", "data-catalog", "data-catalogue",
    "openmetadata", "datahub", "apache-atlas",
}
WAREHOUSE_TECH = {
    "snowflake", "redshift", "bigquery", "databricks",
    "synapse", "clickhouse", "pinot", "druid",
}

ACTIVE_MONTHS = 6  # Consider a repo "active" if pushed to in last N months


class GitHubCollector(BaseCollector):
    SOURCE_NAME = "github"
    BASE_URL = "https://api.github.com"

    def _auth_headers(self) -> dict:
        if settings.github_token:
            return {"Authorization": f"token {settings.github_token}"}
        return {}

    async def collect(self, domain: str, **kwargs) -> CollectorResult:
        result = CollectorResult()
        company_name: str = kwargs.get("company_name", "")
        github_org: str | None = kwargs.get("github_org")

        # Step 1: resolve GitHub org from domain or provided org
        org = github_org or await self._find_org(domain, company_name)
        if not org:
            result.add_error(f"Could not find GitHub org for domain={domain}")
            return result

        result.metadata["github_org"] = org

        # Step 2: list repos
        repos = await self._list_repos(org, result)
        if not repos:
            return result

        result.metadata["repo_count"] = len(repos)

        # Step 3: analyse repos for signals
        await self._analyse_repos(org, repos, result)
        return result

    async def _find_org(self, domain: str, company_name: str) -> str | None:
        """Try to find the GitHub org by searching the domain name."""
        # Extract org candidate from domain
        from app.utils.domain_utils import domain_to_slug
        slug = domain_to_slug(domain)

        for candidate in [slug, company_name.lower().replace(" ", "-"), company_name.lower().replace(" ", "")]:
            try:
                resp = await self._get(
                    f"{self.BASE_URL}/orgs/{candidate}",
                    headers=self._auth_headers(),
                )
                data = resp.json()
                if data.get("login"):
                    return data["login"]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    continue
                logger.debug("GitHub org lookup failed for %s: %s", candidate, e)
            except Exception as e:
                logger.debug("GitHub org lookup error for %s: %s", candidate, e)

        # Fallback: search GitHub
        try:
            resp = await self._get(
                f"{self.BASE_URL}/search/users",
                params={"q": f"{company_name} type:org", "per_page": 3},
                headers=self._auth_headers(),
            )
            items = resp.json().get("items", [])
            if items:
                return items[0]["login"]
        except Exception as e:
            logger.debug("GitHub search fallback failed: %s", e)

        return None

    async def _list_repos(self, org: str, result: CollectorResult) -> list[dict]:
        """Fetch all public repos for the org."""
        repos = []
        page = 1
        while True:
            try:
                resp = await self._get(
                    f"{self.BASE_URL}/orgs/{org}/repos",
                    params={"per_page": 100, "page": page, "type": "public", "sort": "pushed"},
                    headers=self._auth_headers(),
                )
                batch = resp.json()
                if not batch:
                    break
                repos.extend(batch)
                if len(batch) < 100:
                    break
                page += 1
                if page > 5:  # max 500 repos
                    break
            except httpx.HTTPStatusError as e:
                result.add_error(f"GitHub repo list failed for {org}: {e.response.status_code}")
                break
            except Exception as e:
                result.add_error(f"GitHub repo list error: {e}")
                break
        return repos

    async def _analyse_repos(self, org: str, repos: list[dict], result: CollectorResult) -> None:
        """Scan repos for data engineering signals."""
        now = datetime.utcnow()
        cutoff = now - timedelta(days=ACTIVE_MONTHS * 30)

        detected_lakehouse = set()
        detected_warehouses = set()
        detected_dbt = False
        detected_spark = False
        active_data_repos = 0
        all_topics: set[str] = set()

        for repo in repos:
            topics = set(repo.get("topics") or [])
            lang = (repo.get("language") or "").lower()
            name = repo.get("name", "").lower()
            description = (repo.get("description") or "").lower()
            pushed_str = repo.get("pushed_at") or ""

            # Check activity
            is_recent = False
            if pushed_str:
                try:
                    pushed_at = datetime.strptime(pushed_str, "%Y-%m-%dT%H:%M:%SZ")
                    is_recent = pushed_at >= cutoff
                except ValueError:
                    pass

            all_topics.update(topics)

            combined = topics | {name} | set(description.split())

            # Lakehouse tech
            for tech in LAKEHOUSE_TECH:
                if tech in combined or tech in name or tech in description:
                    detected_lakehouse.add(tech)

            # Spark
            for tech in QUERY_ENGINE_TECH:
                if tech in combined or tech in name or tech in description:
                    detected_spark = True

            # dbt
            for tech in DBT_TECH:
                if tech in combined or tech in name or tech in description:
                    detected_dbt = True

            # Warehouse tech
            for tech in WAREHOUSE_TECH:
                if tech in combined or tech in name or tech in description:
                    detected_warehouses.add(tech)

            # Active data repo
            if is_recent and lang in {"python", "sql", "scala", "java", "r"}:
                if any(kw in name + description for kw in ["data", "etl", "pipeline", "analytics", "warehouse", "lake"]):
                    active_data_repos += 1

        # ─── Fire signals based on analysis ──────────────────────────────────

        if detected_lakehouse:
            techs_str = ", ".join(sorted(detected_lakehouse))
            result.add_signal(
                signal_name="github_data_lakehouse_tech",
                signal_tier=1,
                signal_points=10.0,
                source=self.SOURCE_NAME,
                evidence_text=f"Found lakehouse/federated query tech in GitHub org '{org}': {techs_str}",
                evidence_url=f"https://github.com/{org}",
            )

        if len(detected_warehouses) >= 2:
            result.add_signal(
                signal_name="multi_data_warehouse_stack",
                signal_tier=1,
                signal_points=10.0,
                source=self.SOURCE_NAME,
                evidence_text=f"GitHub repos reference multiple competing data warehouses: {', '.join(sorted(detected_warehouses))}",
                evidence_url=f"https://github.com/{org}",
            )

        if detected_dbt:
            result.add_signal(
                signal_name="github_dbt_activity",
                signal_tier=2,
                signal_points=5.0,
                source=self.SOURCE_NAME,
                evidence_text=f"GitHub org '{org}' has active dbt repositories — indicates mature data engineering practice",
                evidence_url=f"https://github.com/{org}",
            )

        if detected_spark:
            result.add_signal(
                signal_name="github_spark_usage",
                signal_tier=3,
                signal_points=2.0,
                source=self.SOURCE_NAME,
                evidence_text=f"GitHub org '{org}' has Apache Spark repositories",
                evidence_url=f"https://github.com/{org}",
            )

        if active_data_repos >= 3:
            result.add_signal(
                signal_name="github_heavy_data_activity",
                signal_tier=3,
                signal_points=2.0,
                source=self.SOURCE_NAME,
                evidence_text=f"GitHub org '{org}' has {active_data_repos} actively maintained data engineering repos in the last {ACTIVE_MONTHS} months",
                evidence_url=f"https://github.com/{org}",
            )

        # SQL-heavy repos
        sql_repos = [r for r in repos if (r.get("language") or "").lower() == "sql"]
        if len(sql_repos) >= 3:
            result.add_signal(
                signal_name="github_sql_heavy_repos",
                signal_tier=3,
                signal_points=2.0,
                source=self.SOURCE_NAME,
                evidence_text=f"GitHub org '{org}' has {len(sql_repos)} SQL-primary repositories — analytics engineering team likely exists",
                evidence_url=f"https://github.com/{org}",
            )
