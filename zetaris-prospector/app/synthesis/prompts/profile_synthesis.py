"""
Claude prompt templates for prospect intelligence profile synthesis.
"""

SYSTEM_PROMPT = """You are a senior enterprise software sales analyst specializing in data infrastructure deals at mid-to-large enterprises. You have deep expertise in data lakehouse, data virtualization, and federated query technologies.

You are analyzing prospects for Zetaris — an AI-powered data lakehouse platform that enables enterprises to query, govern, and operationalize data across multiple sources (Spark, Trino, Presto, DuckDB) without physically moving data. Zetaris's key differentiators:
- Lightning Catalogue: Open-source federated query across any data source
- AI Data Hub: Converged AI + lakehouse layer
- Fluid Data Vault: Streaming/big data automation
- Native Azure Marketplace listing
- Key customers: Telstra, BUPA, NBN, Murdoch Children's Research

The ideal Zetaris customer has:
1. Multiple disjoint data stores (Snowflake + Redshift + on-prem, etc.)
2. Growing analytics/AI initiatives blocked by data fragmentation
3. 500–10,000+ employees in Telecom, Healthcare, Financial Services, Government, or Utilities
4. Active data engineering team (evidenced by GitHub activity, job postings)
5. BI tools that are bottlenecked without a unified data view

Your analysis must be concrete, specific, and actionable for a sales rep."""


def build_profile_prompt(
    company_name: str,
    domain: str,
    signals: list[dict],
    metadata: dict,
) -> str:
    """Build the user-turn prompt for profile synthesis."""

    # Format signals into readable sections
    tier1_signals = [s for s in signals if s.get("signal_tier") == 1]
    tier2_signals = [s for s in signals if s.get("signal_tier") == 2]
    tier3_signals = [s for s in signals if s.get("signal_tier") == 3]
    anti_signals = [s for s in signals if s.get("is_anti_signal")]

    def format_signals(sigs: list[dict]) -> str:
        if not sigs:
            return "  None detected"
        return "\n".join(
            f"  • [{s['signal_name']}] {s['evidence_text']}"
            + (f"\n    Source: {s['evidence_url']}" if s.get('evidence_url') else "")
            for s in sigs
        )

    total_score = sum(s.get("signal_points", 0) for s in signals)

    return f"""Analyze this prospect for Zetaris sales and produce a structured intelligence brief.

## Prospect: {company_name} ({domain})

### Company Profile
- Industry: {metadata.get('industry', 'Unknown')}
- Employee Count: {metadata.get('employee_count', 'Unknown')}
- HQ Country: {metadata.get('country', 'Unknown')}
- Description: {metadata.get('description', 'N/A')}
- GitHub Org: {metadata.get('github_org', 'Not found')}
- ICP Score: {total_score:.1f} raw points

### Detected Signals

**TIER 1 — Critical Signals (10 pts each)**
{format_signals(tier1_signals)}

**TIER 2 — Supporting Signals (5 pts each)**
{format_signals(tier2_signals)}

**TIER 3 — Weak Signals (2 pts each)**
{format_signals(tier3_signals)}

**ANTI-SIGNALS / Disqualifiers**
{format_signals(anti_signals)}

---

Produce a structured intelligence brief in this exact format:

## Executive Summary
[2–3 sentences: Who is this company, why are they a Zetaris prospect, and what is the urgency level?]

## Why Zetaris, Why Now
[3–5 specific reasons grounded in the detected signals above. Be concrete about which signals indicate the exact pain Zetaris solves. Reference specific technologies/initiatives detected.]

## Key Stakeholders to Target
[List 2–3 personas with their likely title, their data pain, and the angle to use with each]

## Zetaris Value Proposition Angle
[Which Zetaris product/feature maps most directly to this company's pain? Lightning Catalogue? AI Data Hub? Reference their specific stack.]

## Likely Objections & Responses
[2–3 objections a sales rep should anticipate, with brief responses]

## Competitive Displacement Risk
[Are they likely using a competitor? What's the risk level and how to approach it?]

## Recommended First Move
[One concrete next action: who to contact, what message angle, what trigger event to reference]"""
