"""
Outreach Message Generator
===========================
Calls Claude to generate 3 personalized outreach variants for a prospect.
Uses claude-haiku for cost efficiency (sufficient for creative writing).
"""
import logging
import re
from typing import TYPE_CHECKING

from app.synthesis.claude_client import get_claude_client
from app.synthesis.prompts.outreach_generation import SYSTEM_PROMPT, build_outreach_prompt

if TYPE_CHECKING:
    from app.models.prospect import Prospect, ProspectSignal

logger = logging.getLogger(__name__)


async def generate_outreach(
    prospect: "Prospect",
    signals: list["ProspectSignal"],
    channel: str = "cold-email",
    target_persona: str = "cdo",
    sender_persona: str = "ae",
) -> dict[str, str]:
    """
    Generate 3 outreach message variants for a prospect.
    Returns dict with keys: variant_a, variant_b, variant_c
    """
    # Extract key signal evidence strings (most impactful signals first)
    sorted_signals = sorted(signals, key=lambda s: abs(s.signal_points), reverse=True)
    key_signals = [
        s.evidence_text
        for s in sorted_signals[:6]
        if s.evidence_text and not s.is_anti_signal
    ]

    user_prompt = build_outreach_prompt(
        company_name=prospect.company_name,
        intelligence_profile=prospect.intelligence_profile or "",
        channel=channel,
        target_persona=target_persona,
        sender_persona=sender_persona,
        key_signals=key_signals,
    )

    client = get_claude_client()
    try:
        raw_output = client.complete(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            task="outreach",
        )
        variants = _parse_variants(raw_output)
        logger.info(
            "Outreach generated for %s: channel=%s persona=%s",
            prospect.company_name, channel, target_persona,
        )
        return variants
    except Exception as e:
        logger.error("Outreach generation failed for %s: %s", prospect.company_name, e)
        raise


def _parse_variants(raw: str) -> dict[str, str]:
    """
    Parse Claude's output into variant_a, variant_b, variant_c.
    Claude is prompted to label them VARIANT A, VARIANT B, VARIANT C.
    """
    variants = {"variant_a": "", "variant_b": "", "variant_c": ""}

    # Split on variant labels
    pattern = r"(?i)VARIANT\s+([ABC])"
    parts = re.split(pattern, raw)

    if len(parts) >= 7:
        # parts[0] = preamble, parts[1] = "A", parts[2] = content A,
        # parts[3] = "B", parts[4] = content B, parts[5] = "C", parts[6] = content C
        variants["variant_a"] = parts[2].strip()
        variants["variant_b"] = parts[4].strip()
        variants["variant_c"] = parts[6].strip()
    else:
        # Fallback: split into thirds
        lines = raw.strip().split("\n")
        third = max(1, len(lines) // 3)
        variants["variant_a"] = "\n".join(lines[:third]).strip()
        variants["variant_b"] = "\n".join(lines[third : third * 2]).strip()
        variants["variant_c"] = "\n".join(lines[third * 2 :]).strip()

    return variants
