"""
Claude prompt templates for personalized outreach generation.
"""

SYSTEM_PROMPT = """You are a B2B sales copywriter specializing in enterprise data infrastructure. You write outreach messages for Zetaris — an AI-powered data lakehouse platform that eliminates data silos by enabling federated query across any data source without moving data.

Zetaris key proof points:
- Customers: Telstra, BUPA, NBN, Murdoch Children's Research
- Azure Marketplace native listing (can go through existing Azure commitment)
- Compressed data modernization from 18 months → 6 months
- No-code POC that can federate existing sources in hours
- Open-source Lightning Catalogue: federated SQL across Snowflake, Redshift, S3, databases simultaneously

Writing principles:
- Lead with THEIR pain, not Zetaris features
- Reference specific signals detected about their company (stack, news, job postings)
- Be specific — name technologies they use, reference their actual initiatives
- Keep cold email subject lines under 8 words
- LinkedIn connection notes max 300 characters
- Do NOT use "I hope this email finds you well" or similar filler
- Do NOT use ALL CAPS for emphasis
- Sound like a human, not a vendor pitch"""


def build_outreach_prompt(
    company_name: str,
    intelligence_profile: str,
    channel: str,
    target_persona: str,
    sender_persona: str,
    key_signals: list[str],
) -> str:
    """Build the outreach generation prompt."""

    persona_descriptions = {
        "cdo": "Chief Data Officer — owns the data strategy, frustrated by fragmented data, measured on analytics ROI",
        "vp-data": "VP of Data / Head of Data — manages data engineering team, dealing with too many pipelines and point solutions",
        "vp-engineering": "VP of Engineering — owns the platform, worried about infrastructure complexity and maintenance burden",
        "cto": "CTO — focused on strategic bets and AI/ML readiness, concerned about time-to-value",
        "data-architect": "Data Architect / Principal Data Engineer — deep in the technical weeds, evaluating platform options",
    }

    channel_instructions = {
        "cold-email": "Write a cold outreach EMAIL. Include: (1) subject line, (2) email body (150–200 words max). No pleasantries opener.",
        "linkedin": "Write a LinkedIn CONNECTION REQUEST note (max 300 characters total). Be direct about the relevant connection.",
        "followup": "Write a follow-up email for someone who didn't reply to a first touch (100–150 words). Reference the first email without being pushy.",
    }

    sender_context = {
        "ae": "Account Executive — has authority, references customer outcomes",
        "sdr": "Sales Development Rep — books discovery calls, humble and direct",
    }

    signals_text = "\n".join(f"- {s}" for s in key_signals) if key_signals else "- Multiple data infrastructure signals detected"

    return f"""Generate 3 outreach message variants (A, B, C) for the following scenario.

## Target Company: {company_name}
## Channel: {channel_instructions.get(channel, channel)}
## Target Persona: {persona_descriptions.get(target_persona, target_persona)}
## Sender: {sender_context.get(sender_persona, sender_persona)}

## Key Signals Detected About This Company
{signals_text}

## Intelligence Profile Summary
{intelligence_profile[:2000] if intelligence_profile else 'No profile available — use the signals above.'}

---

Generate exactly 3 variants with these distinct tones:
- **Variant A — Problem-led**: Open with their specific pain point (data fragmentation, multi-system complexity)
- **Variant B — Trigger-led**: Reference a specific recent signal (news event, job posting, tech stack detected)
- **Variant C — Outcome-led**: Lead with a relevant customer outcome (Telstra/BUPA/NBN if applicable)

For each variant, clearly label it as VARIANT A, VARIANT B, or VARIANT C.

Make each message feel like it was written specifically for this company — reference their actual technologies, initiatives, or industry context. Avoid generic data platform language."""
