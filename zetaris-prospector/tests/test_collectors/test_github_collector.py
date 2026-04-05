"""Tests for the GitHub collector."""
import pytest
import respx
import httpx

from app.collectors.github_collector import GitHubCollector


@pytest.fixture
def collector():
    return GitHubCollector()


class TestGitHubCollector:

    @respx.mock
    @pytest.mark.asyncio
    async def test_detects_lakehouse_tech(self, collector):
        """Should fire tier-1 signal when org has Iceberg/Trino repos."""
        # Mock org lookup
        respx.get("https://api.github.com/orgs/telstra").mock(
            return_value=httpx.Response(200, json={"login": "telstra"})
        )
        # Mock repos list
        respx.get("https://api.github.com/orgs/telstra/repos").mock(
            return_value=httpx.Response(200, json=[
                {
                    "name": "data-lake-iceberg",
                    "topics": ["iceberg", "apache-iceberg"],
                    "language": "Python",
                    "pushed_at": "2026-01-15T10:00:00Z",
                    "description": "Apache Iceberg data lake",
                }
            ])
        )

        result = await collector.collect("telstra.com", company_name="Telstra", github_org="telstra")

        signal_names = [s["signal_name"] for s in result.signals]
        assert "github_data_lakehouse_tech" in signal_names

        lakehouse_sig = next(s for s in result.signals if s["signal_name"] == "github_data_lakehouse_tech")
        assert lakehouse_sig["signal_points"] == 10.0
        assert lakehouse_sig["signal_tier"] == 1

    @respx.mock
    @pytest.mark.asyncio
    async def test_detects_multi_warehouse(self, collector):
        """Should fire tier-1 signal when multiple DW tools detected."""
        respx.get("https://api.github.com/orgs/acme").mock(
            return_value=httpx.Response(200, json={"login": "acme"})
        )
        respx.get("https://api.github.com/orgs/acme/repos").mock(
            return_value=httpx.Response(200, json=[
                {"name": "snowflake-connector", "topics": ["snowflake"], "language": "Python", "pushed_at": "2026-01-01T00:00:00Z", "description": ""},
                {"name": "redshift-utils", "topics": ["redshift"], "language": "Python", "pushed_at": "2026-01-01T00:00:00Z", "description": ""},
                {"name": "bigquery-pipeline", "topics": ["bigquery"], "language": "Python", "pushed_at": "2026-01-01T00:00:00Z", "description": ""},
            ])
        )

        result = await collector.collect("acme.com", company_name="Acme", github_org="acme")
        signal_names = [s["signal_name"] for s in result.signals]
        assert "multi_data_warehouse_stack" in signal_names

    @respx.mock
    @pytest.mark.asyncio
    async def test_org_not_found_returns_error(self, collector):
        """Should add error when org not found, not raise exception."""
        respx.get("https://api.github.com/orgs/nonexistent").mock(
            return_value=httpx.Response(404, json={"message": "Not Found"})
        )
        respx.get("https://api.github.com/search/users").mock(
            return_value=httpx.Response(200, json={"items": []})
        )

        result = await collector.collect("nonexistent-corp.com", company_name="Nonexistent Corp")
        assert len(result.errors) > 0
        assert len(result.signals) == 0
