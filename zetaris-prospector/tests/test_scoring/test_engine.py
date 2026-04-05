"""Tests for the ICP scoring engine."""
import pytest
from unittest.mock import MagicMock

from app.scoring.engine import calculate_score, classify_tier, ScoringResult


def make_signal(name: str, tier: int, points: float, is_anti: bool = False):
    s = MagicMock()
    s.signal_name = name
    s.signal_tier = tier
    s.signal_points = points
    s.is_anti_signal = is_anti
    return s


class TestCalculateScore:
    def test_empty_signals_returns_zero(self):
        result = calculate_score([])
        assert result.score == 0.0
        assert result.tier == "Disqualified"
        assert result.signal_count == 0

    def test_single_tier1_signal(self):
        signals = [make_signal("github_data_lakehouse_tech", 1, 10.0)]
        result = calculate_score(signals)
        assert result.score == pytest.approx(14.28, abs=1.0)
        assert result.tier == "Cold"

    def test_multiple_tier1_signals_approach_hot(self):
        signals = [
            make_signal("github_data_lakehouse_tech", 1, 10.0),
            make_signal("multi_data_warehouse_stack", 1, 10.0),
            make_signal("job_posting_data_federation", 1, 10.0),
            make_signal("news_data_platform_initiative", 1, 10.0),
            make_signal("sec_data_transformation_initiative", 1, 10.0),
        ]
        result = calculate_score(signals)
        assert result.score >= 70.0
        assert result.tier == "Hot"

    def test_anti_signal_reduces_score(self):
        positive = [make_signal("github_data_lakehouse_tech", 1, 10.0)]
        anti = [make_signal("anti_too_small", 0, -10.0, is_anti=True)]
        result = calculate_score(positive + anti)
        assert result.score == 0.0
        assert result.negative_points == -10.0

    def test_score_caps_at_100(self):
        # Generate far more than 70 raw points
        signals = [make_signal(f"sig_{i}", 1, 10.0) for i in range(20)]
        result = calculate_score(signals)
        assert result.score == 100.0

    def test_breakdown_groups_by_signal_name(self):
        signals = [
            make_signal("github_data_lakehouse_tech", 1, 10.0),
            make_signal("github_data_lakehouse_tech", 1, 10.0),  # duplicate
        ]
        result = calculate_score(signals)
        assert result.breakdown["github_data_lakehouse_tech"] == 20.0

    def test_warm_tier_boundary(self):
        # 40 normalized → Warm
        # 40/100 * 70 raw = 28 raw points
        signals = [
            make_signal("a", 1, 10.0),
            make_signal("b", 1, 10.0),
            make_signal("c", 2, 5.0),
            make_signal("d", 2, 5.0),
        ]
        result = calculate_score(signals)
        assert result.tier in ("Warm", "Hot")  # ≥30 raw → ≥42 normalized


class TestClassifyTier:
    @pytest.mark.parametrize("score,expected", [
        (75.0, "Hot"),
        (70.0, "Hot"),
        (69.9, "Warm"),
        (40.0, "Warm"),
        (39.9, "Cold"),
        (15.0, "Cold"),
        (14.9, "Disqualified"),
        (0.0, "Disqualified"),
    ])
    def test_tier_boundaries(self, score, expected):
        assert classify_tier(score) == expected
