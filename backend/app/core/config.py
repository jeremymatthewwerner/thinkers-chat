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

    # Database - SQLite for local dev, PostgreSQL for production
    database_url: str = "sqlite+aiosqlite:///./thinkers_chat.db"

    @property
    def async_database_url(self) -> str:
        """Get database URL with async driver for SQLAlchemy."""
        url = self.database_url
        # Convert Railway's postgresql:// to postgresql+asyncpg://
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Convert postgres:// (also valid) to postgresql+asyncpg://
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

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
