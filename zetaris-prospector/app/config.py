from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Anthropic
    anthropic_api_key: str = ""

    # GitHub
    github_token: Optional[str] = None

    # News
    guardian_api_key: Optional[str] = None
    news_api_key: Optional[str] = None

    # Jobs
    adzuna_app_id: Optional[str] = None
    adzuna_api_key: Optional[str] = None

    # Tech Stack
    detectzestack_api_key: Optional[str] = None

    # Enrichment
    hunter_api_key: Optional[str] = None

    # App
    database_url: str = "sqlite+aiosqlite:///./zetaris_prospects.db"
    log_level: str = "INFO"
    max_concurrent_enrichments: int = 3

    # Claude
    claude_model: str = "claude-sonnet-4-6"
    claude_synthesis_max_tokens: int = 1500
    claude_outreach_max_tokens: int = 800

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in valid:
            raise ValueError(f"log_level must be one of {valid}")
        return upper


settings = Settings()
