"""
Anthropic Claude API Client
============================
Wrapper around the Anthropic SDK with retry logic, cost tracking,
and model selection based on task complexity.
"""
import logging
from typing import Literal

import anthropic
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.config import settings

logger = logging.getLogger(__name__)

# Approximate token costs (USD per 1M tokens) for tracking
COST_PER_1M = {
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 0.25, "output": 1.25},
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
}

_usage_tracker: dict[str, float] = {"total_usd": 0.0, "total_tokens": 0}


class ClaudeClient:
    def __init__(self):
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set in environment")
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((anthropic.APITimeoutError, anthropic.InternalServerError)),
        reraise=True,
    )
    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        max_tokens: int | None = None,
        task: Literal["synthesis", "outreach", "scoring"] = "synthesis",
    ) -> str:
        """
        Send a completion request to Claude.
        Automatically selects model and token budget based on task if not specified.
        """
        if model is None:
            model = (
                settings.claude_model
                if task == "synthesis"
                else "claude-haiku-4-5-20251001"
            )

        if max_tokens is None:
            max_tokens = (
                settings.claude_synthesis_max_tokens
                if task == "synthesis"
                else settings.claude_outreach_max_tokens
            )

        try:
            response = self._client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            # Track usage
            usage = response.usage
            self._track_cost(model, usage.input_tokens, usage.output_tokens)

            return response.content[0].text

        except anthropic.AuthenticationError:
            raise ValueError("Invalid ANTHROPIC_API_KEY — check your .env file")
        except anthropic.RateLimitError as e:
            logger.warning("Claude rate limit hit: %s", e)
            raise
        except anthropic.BadRequestError as e:
            logger.error("Claude bad request: %s", e)
            raise

    def _track_cost(self, model: str, input_tokens: int, output_tokens: int) -> None:
        costs = COST_PER_1M.get(model, {"input": 3.0, "output": 15.0})
        cost = (input_tokens * costs["input"] + output_tokens * costs["output"]) / 1_000_000
        _usage_tracker["total_usd"] += cost
        _usage_tracker["total_tokens"] += input_tokens + output_tokens
        logger.debug(
            "Claude usage: model=%s in=%d out=%d cost=$%.4f (session total: $%.4f)",
            model, input_tokens, output_tokens, cost, _usage_tracker["total_usd"],
        )

    @staticmethod
    def get_session_cost() -> dict:
        return {
            "total_usd": round(_usage_tracker["total_usd"], 4),
            "total_tokens": _usage_tracker["total_tokens"],
        }


# Module-level singleton
_client: ClaudeClient | None = None


def get_claude_client() -> ClaudeClient:
    global _client
    if _client is None:
        _client = ClaudeClient()
    return _client
