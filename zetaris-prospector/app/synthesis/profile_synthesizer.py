"""
Prospect Intelligence Profile Synthesizer
==========================================
Calls Claude with all detected signals to produce a structured
intelligence brief for a prospect.
"""
import logging
from typing import TYPE_CHECKING

from app.synthesis.claude_client import get_claude_client
from app.synthesis.prompts.profile_synthesis import SYSTEM_PROMPT, build_profile_prompt

if TYPE_CHECKING:
    from app.models.prospect import Prospect, ProspectSignal

logger = logging.getLogger(__name__)


async def synthesize_profile(
    prospect: "Prospect",
    signals: list["ProspectSignal"],
    force: bool = False,
) -> str:
    """
    Generate a Claude intelligence profile for a prospect.
    Returns the profile markdown string.
    """
    if not signals:
        return "## No Data Available\n\nNo signals have been collected for this prospect yet. Run enrichment first."

    # Build signal dicts for the prompt
    signal_dicts = [
        {
            "signal_name": s.signal_name,
            "signal_tier": s.signal_tier,
            "signal_points": s.signal_points,
            "evidence_text": s.evidence_text or "",
            "evidence_url": s.evidence_url,
            "source": s.source,
            "is_anti_signal": s.is_anti_signal,
        }
        for s in signals
    ]

    # Build metadata from prospect fields
    metadata = {
        "industry": prospect.industry or "Unknown",
        "employee_count": prospect.employee_count,
        "country": prospect.hq_country or "Unknown",
        "description": prospect.description or "",
        "github_org": prospect.github_org or "Not found",
    }

    user_prompt = build_profile_prompt(
        company_name=prospect.company_name,
        domain=prospect.domain,
        signals=signal_dicts,
        metadata=metadata,
    )

    client = get_claude_client()
    try:
        profile = client.complete(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            task="synthesis",
        )
        logger.info("Profile synthesized for %s (%d signals)", prospect.company_name, len(signals))
        return profile
    except Exception as e:
        logger.error("Profile synthesis failed for %s: %s", prospect.company_name, e)
        raise
