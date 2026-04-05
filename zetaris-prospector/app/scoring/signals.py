"""
Zetaris ICP Signal Registry
============================
Each signal has a name, tier, base points, category, and description.
The scoring engine reads this registry to weight detected signals.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class SignalDefinition:
    name: str
    tier: int          # 1 = strongest, 2 = strong, 3 = weak, 0 = anti-signal
    points: float
    category: str
    description: str
    source_hint: str   # which collector typically fires this


# ─── Tier 1 — Strongest signals (10 pts) ─────────────────────────────────────

TIER1_SIGNALS: list[SignalDefinition] = [
    SignalDefinition(
        name="job_posting_data_federation",
        tier=1, points=10.0,
        category="hiring",
        description="Job posting mentions federated query, data virtualization, data mesh, or data fabric",
        source_hint="jobs_collector",
    ),
    SignalDefinition(
        name="job_posting_multi_engine",
        tier=1, points=10.0,
        category="hiring",
        description="Job posting requires experience with 2+ query engines: Spark + Trino, Presto, DuckDB simultaneously",
        source_hint="jobs_collector",
    ),
    SignalDefinition(
        name="github_data_lakehouse_tech",
        tier=1, points=10.0,
        category="technology",
        description="GitHub org has repos using Apache Iceberg, Delta Lake, Apache Hudi, or Trino",
        source_hint="github_collector",
    ),
    SignalDefinition(
        name="multi_data_warehouse_stack",
        tier=1, points=10.0,
        category="technology",
        description="Tech stack shows simultaneous use of 2+ competing data warehouses (Snowflake + Redshift, Databricks + BigQuery, etc.)",
        source_hint="techstack_collector",
    ),
    SignalDefinition(
        name="sec_data_transformation_initiative",
        tier=1, points=10.0,
        category="strategic",
        description="SEC 10-K/8-K filing mentions data modernization, data lake, analytics transformation as a strategic initiative",
        source_hint="sec_collector",
    ),
    SignalDefinition(
        name="news_data_platform_initiative",
        tier=1, points=10.0,
        category="strategic",
        description="Recent news (<90 days) announces a data transformation initiative, new CDO/CTO hire, or major cloud migration",
        source_hint="news_collector",
    ),
]

# ─── Tier 2 — Strong supporting signals (5 pts) ──────────────────────────────

TIER2_SIGNALS: list[SignalDefinition] = [
    SignalDefinition(
        name="zetaris_target_industry",
        tier=2, points=5.0,
        category="firmographic",
        description="Company is in Zetaris's confirmed sweet-spot: Telecom, Healthcare/Life Sciences, Financial Services, Government, Utilities",
        source_hint="hunter_collector",
    ),
    SignalDefinition(
        name="data_role_hiring_volume",
        tier=2, points=5.0,
        category="hiring",
        description="3+ simultaneous open data engineering / data scientist / ML engineer roles",
        source_hint="jobs_collector",
    ),
    SignalDefinition(
        name="enterprise_employee_count",
        tier=2, points=5.0,
        category="firmographic",
        description="Company has 500–10,000 employees (mid-to-large enterprise sweet spot)",
        source_hint="hunter_collector",
    ),
    SignalDefinition(
        name="bi_tooling_detected",
        tier=2, points=5.0,
        category="technology",
        description="Tech stack includes Tableau, Power BI, or Looker — BI tools that become bottlenecked without unified data",
        source_hint="techstack_collector",
    ),
    SignalDefinition(
        name="azure_cloud_detected",
        tier=2, points=5.0,
        category="technology",
        description="Company is running on Azure — Zetaris has a native Azure Marketplace offering",
        source_hint="techstack_collector",
    ),
    SignalDefinition(
        name="github_dbt_activity",
        tier=2, points=5.0,
        category="technology",
        description="GitHub org has active dbt (data build tool) repos — indicates mature data engineering practice",
        source_hint="github_collector",
    ),
    SignalDefinition(
        name="recent_funding_round",
        tier=2, points=5.0,
        category="strategic",
        description="Recently closed Series B/C or later funding round — budget available for infrastructure investment",
        source_hint="news_collector",
    ),
    SignalDefinition(
        name="job_posting_modern_data_stack",
        tier=2, points=5.0,
        category="hiring",
        description="Job posting or careers page mentions 'modern data stack', 'data platform', or 'cloud data warehouse'",
        source_hint="jobs_collector",
    ),
]

# ─── Tier 3 — Weak but accumulating signals (2 pts) ──────────────────────────

TIER3_SIGNALS: list[SignalDefinition] = [
    SignalDefinition(
        name="github_heavy_data_activity",
        tier=3, points=2.0,
        category="technology",
        description="GitHub org shows heavy Python/SQL data engineering activity in last 6 months",
        source_hint="github_collector",
    ),
    SignalDefinition(
        name="multi_cloud_detected",
        tier=3, points=2.0,
        category="technology",
        description="Company uses multiple cloud providers simultaneously (multi-cloud flag)",
        source_hint="techstack_collector",
    ),
    SignalDefinition(
        name="careers_page_data_platform_mention",
        tier=3, points=2.0,
        category="hiring",
        description="Careers page mentions 'data platform' or 'analytics engineering'",
        source_hint="techstack_collector",
    ),
    SignalDefinition(
        name="news_cloud_migration_mention",
        tier=3, points=2.0,
        category="strategic",
        description="News mention of cloud migration or infrastructure modernization (older than 90 days)",
        source_hint="news_collector",
    ),
    SignalDefinition(
        name="github_spark_usage",
        tier=3, points=2.0,
        category="technology",
        description="GitHub org has repos using Apache Spark",
        source_hint="github_collector",
    ),
    SignalDefinition(
        name="github_sql_heavy_repos",
        tier=3, points=2.0,
        category="technology",
        description="GitHub org has SQL-heavy repos suggesting analytics engineering team exists",
        source_hint="github_collector",
    ),
]

# ─── Anti-signals (-10 pts) ───────────────────────────────────────────────────

ANTI_SIGNALS: list[SignalDefinition] = [
    SignalDefinition(
        name="anti_too_small",
        tier=0, points=-10.0,
        category="firmographic",
        description="Company has fewer than 50 employees — not enough data complexity for federation to matter",
        source_hint="hunter_collector",
    ),
    SignalDefinition(
        name="anti_single_cloud_dw",
        tier=0, points=-10.0,
        category="technology",
        description="Tech stack shows only a single cloud-native DW with no other competing stores — no federation pain yet",
        source_hint="techstack_collector",
    ),
    SignalDefinition(
        name="anti_known_competitor_customer",
        tier=0, points=-10.0,
        category="competitive",
        description="Confirmed Denodo or Dremio customer — already solved the federation problem",
        source_hint="news_collector",
    ),
    SignalDefinition(
        name="anti_is_competitor",
        tier=0, points=-10.0,
        category="competitive",
        description="Company is a direct competitor (Databricks, Snowflake, AWS, Google, Microsoft at scale)",
        source_hint="hunter_collector",
    ),
]

# ─── Full registry ────────────────────────────────────────────────────────────

ALL_SIGNALS: dict[str, SignalDefinition] = {
    s.name: s
    for s in TIER1_SIGNALS + TIER2_SIGNALS + TIER3_SIGNALS + ANTI_SIGNALS
}


def get_signal(name: str) -> SignalDefinition | None:
    return ALL_SIGNALS.get(name)


def get_signals_by_source(source: str) -> list[SignalDefinition]:
    return [s for s in ALL_SIGNALS.values() if s.source_hint == source]
