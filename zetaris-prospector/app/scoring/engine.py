"""
ICP Scoring Engine
==================
Pure function: takes a list of ProspectSignal ORM objects and returns
a normalized score (0–100), tier label, and signal breakdown dict.
"""
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.prospect import ProspectSignal


# Raw points at which the prospect reaches 100 normalized score
# (prevents a single data-rich company from trivially hitting max)
_RAW_CEILING = 70.0

TIER_THRESHOLDS = {
    "Hot": 70.0,
    "Warm": 40.0,
    "Cold": 15.0,
}


@dataclass
class ScoringResult:
    score: float               # 0–100 normalized
    raw_score: float           # sum of all signal points (can exceed 100)
    tier: str                  # Hot / Warm / Cold / Disqualified
    breakdown: dict[str, float]  # signal_name → points
    positive_points: float
    negative_points: float
    signal_count: int


def calculate_score(signals: list["ProspectSignal"]) -> ScoringResult:
    """
    Aggregate a list of ProspectSignal records into an ICP score.

    Rules:
    - Anti-signals (negative points) are applied without cap
    - Positive signals are summed then capped at _RAW_CEILING before normalization
    - Final score = max(0, (capped_positive + negatives) / _RAW_CEILING * 100)
    """
    positive = sum(s.signal_points for s in signals if s.signal_points > 0)
    negative = sum(s.signal_points for s in signals if s.signal_points < 0)

    capped_positive = min(positive, _RAW_CEILING)
    raw_combined = capped_positive + negative

    normalized = max(0.0, (raw_combined / _RAW_CEILING) * 100.0)
    normalized = min(normalized, 100.0)

    breakdown = {}
    for s in signals:
        # Accumulate points per signal name (multiple detections of same signal)
        breakdown[s.signal_name] = breakdown.get(s.signal_name, 0.0) + s.signal_points

    return ScoringResult(
        score=round(normalized, 2),
        raw_score=round(positive + negative, 2),
        tier=classify_tier(normalized),
        breakdown=breakdown,
        positive_points=round(positive, 2),
        negative_points=round(negative, 2),
        signal_count=len(signals),
    )


def classify_tier(score: float) -> str:
    if score >= TIER_THRESHOLDS["Hot"]:
        return "Hot"
    if score >= TIER_THRESHOLDS["Warm"]:
        return "Warm"
    if score >= TIER_THRESHOLDS["Cold"]:
        return "Cold"
    return "Disqualified"
