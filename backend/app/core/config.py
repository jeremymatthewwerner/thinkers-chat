"""Application configuration using pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database - SQLite for MVP, can switch to PostgreSQL later
    database_url: str = "sqlite+aiosqlite:///./thinkers_chat.db"

    # Anthropic API
    anthropic_api_key: str = ""

    # Application settings
    debug: bool = False

    # CORS settings (comma-separated list of allowed origins)
    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
