"""Text processing utilities for keyword matching and cleaning."""
import re
from typing import Iterable


def keyword_match(text: str, keywords: Iterable[str]) -> list[str]:
    """Return list of keywords found in text (case insensitive)."""
    text_lower = text.lower()
    return [kw for kw in keywords if kw.lower() in text_lower]


def clean_text(text: str, max_len: int = 500) -> str:
    """Clean and truncate text for storage as evidence."""
    if not text:
        return ""
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text.strip())
    return text[:max_len]


def truncate(text: str, max_len: int = 200, suffix: str = "...") -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - len(suffix)] + suffix
