"""
ICP Rule-Based Pre-screening
============================
These rules run on basic prospect attributes (before deep enrichment)
to fast-path obvious disqualifications or flag instant opportunities.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class PreScreenResult:
    should_enrich: bool
    reason: str
    fast_tags: list[str]  # tags to apply immediately


COMPETITOR_KEYWORDS = {
    "databricks", "snowflake", "amazon web services", "google cloud",
    "microsoft azure", "dremio", "denodo", "starburst", "atscale",
    "tibco", "talend", "informatica",
}

SWEET_SPOT_INDUSTRIES = {
    "telecommunications", "telecom", "telco",
    "healthcare", "health care", "life sciences", "biotech", "pharma",
    "financial services", "banking", "insurance", "fintech",
    "utilities", "energy", "government", "public sector",
    "retail", "logistics", "manufacturing",
}

SWEET_SPOT_DOMAINS = {
    # Known Zetaris target verticals by TLD
    ".gov", ".gov.au", ".health",
}


def pre_screen(
    company_name: str,
    domain: str,
    industry: Optional[str] = None,
    employee_count: Optional[int] = None,
) -> PreScreenResult:
    """Quick rules-based pre-screening before API enrichment."""
    tags: list[str] = []
    name_lower = company_name.lower()

    # Disqualify obvious competitors
    for keyword in COMPETITOR_KEYWORDS:
        if keyword in name_lower:
            return PreScreenResult(
                should_enrich=False,
                reason=f"Likely competitor: '{keyword}' in company name",
                fast_tags=["competitor", "disqualified"],
            )

    # Disqualify companies that are clearly too small
    if employee_count is not None and employee_count < 50:
        return PreScreenResult(
            should_enrich=False,
            reason=f"Too small: {employee_count} employees (minimum 50)",
            fast_tags=["too-small", "disqualified"],
        )

    # Tag sweet-spot industries
    if industry:
        industry_lower = industry.lower()
        for ind in SWEET_SPOT_INDUSTRIES:
            if ind in industry_lower:
                tags.append("sweet-spot-industry")
                break

    # Tag by domain TLD
    for tld in SWEET_SPOT_DOMAINS:
        if domain.endswith(tld):
            tags.append("gov-or-health-domain")
            break

    # Flag large enterprises
    if employee_count is not None and employee_count >= 1000:
        tags.append("large-enterprise")
    elif employee_count is not None and employee_count >= 500:
        tags.append("mid-enterprise")

    return PreScreenResult(
        should_enrich=True,
        reason="Passed pre-screening",
        fast_tags=tags,
    )
