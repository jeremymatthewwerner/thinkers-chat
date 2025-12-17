"""Tests for configuration settings."""

import pytest

from app.core.config import Settings


class TestAsyncDatabaseUrl:
    """Tests for async_database_url property."""

    def test_sqlite_url_unchanged(self) -> None:
        """SQLite URLs should pass through unchanged."""
        settings = Settings(database_url="sqlite+aiosqlite:///./test.db")
        assert settings.async_database_url == "sqlite+aiosqlite:///./test.db"

    def test_postgresql_url_converted(self) -> None:
        """postgresql:// should be converted to postgresql+asyncpg://."""
        settings = Settings(
            database_url="postgresql://user:pass@host:5432/db"
        )
        assert settings.async_database_url == "postgresql+asyncpg://user:pass@host:5432/db"

    def test_postgres_url_converted(self) -> None:
        """postgres:// (Railway format) should be converted to postgresql+asyncpg://."""
        settings = Settings(
            database_url="postgres://user:pass@host:5432/db"
        )
        assert settings.async_database_url == "postgresql+asyncpg://user:pass@host:5432/db"

    def test_already_async_url_unchanged(self) -> None:
        """URLs already using asyncpg should pass through unchanged."""
        settings = Settings(
            database_url="postgresql+asyncpg://user:pass@host:5432/db"
        )
        assert settings.async_database_url == "postgresql+asyncpg://user:pass@host:5432/db"
