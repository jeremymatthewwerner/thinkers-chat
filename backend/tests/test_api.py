"""Tests for API endpoints."""

from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.database import get_db
from app.main import app
from app.models import Base


@pytest.fixture
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create an in-memory SQLite engine for testing."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Create a database session for testing."""
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session


@pytest.fixture
async def client(engine: AsyncEngine) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database override."""
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


class TestSessionAPI:
    """Tests for session endpoints."""

    async def test_create_session(self, client: AsyncClient) -> None:
        """Test creating a new session."""
        response = await client.post("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert len(data["id"]) == 36  # UUID format
        assert "created_at" in data

    async def test_get_current_session(self, client: AsyncClient) -> None:
        """Test getting current session."""
        # First create a session
        create_response = await client.post("/api/sessions")
        session_id = create_response.json()["id"]

        # Then get it
        response = await client.get(
            "/api/sessions/me",
            headers={"X-Session-ID": session_id},
        )
        assert response.status_code == 200
        assert response.json()["id"] == session_id

    async def test_get_session_not_found(self, client: AsyncClient) -> None:
        """Test getting non-existent session."""
        response = await client.get(
            "/api/sessions/me",
            headers={"X-Session-ID": "non-existent-id"},
        )
        assert response.status_code == 404


class TestConversationAPI:
    """Tests for conversation endpoints."""

    async def test_create_conversation(self, client: AsyncClient) -> None:
        """Test creating a new conversation."""
        # First create a session
        session_response = await client.post("/api/sessions")
        session_id = session_response.json()["id"]

        # Create conversation
        response = await client.post(
            "/api/conversations",
            headers={"X-Session-ID": session_id},
            json={
                "topic": "What is consciousness?",
                "thinkers": [
                    {
                        "name": "Socrates",
                        "bio": "Ancient Greek philosopher",
                        "positions": "Socratic method",
                        "style": "Questions everything",
                    },
                    {
                        "name": "Einstein",
                        "bio": "Theoretical physicist",
                        "positions": "Theory of relativity",
                        "style": "Thought experiments",
                    },
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["topic"] == "What is consciousness?"
        assert len(data["thinkers"]) == 2
        assert data["thinkers"][0]["name"] == "Socrates"

    async def test_create_conversation_creates_session(self, client: AsyncClient) -> None:
        """Test that creating a conversation auto-creates a session."""
        response = await client.post(
            "/api/conversations",
            json={
                "topic": "Philosophy",
                "thinkers": [
                    {
                        "name": "Aristotle",
                        "bio": "Greek philosopher",
                        "positions": "Virtue ethics",
                        "style": "Systematic",
                    },
                ],
            },
        )
        assert response.status_code == 200
        assert response.json()["session_id"] is not None

    async def test_list_conversations(self, client: AsyncClient) -> None:
        """Test listing conversations for a session."""
        # Create session
        session_response = await client.post("/api/sessions")
        session_id = session_response.json()["id"]

        # Create conversations
        for topic in ["Topic 1", "Topic 2"]:
            await client.post(
                "/api/conversations",
                headers={"X-Session-ID": session_id},
                json={
                    "topic": topic,
                    "thinkers": [
                        {
                            "name": "Thinker",
                            "bio": "Bio",
                            "positions": "Positions",
                            "style": "Style",
                        },
                    ],
                },
            )

        # List conversations
        response = await client.get(
            "/api/conversations",
            headers={"X-Session-ID": session_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    async def test_get_conversation(self, client: AsyncClient) -> None:
        """Test getting a conversation with messages."""
        # Create session
        session_response = await client.post("/api/sessions")
        session_id = session_response.json()["id"]

        # Create conversation
        conv_response = await client.post(
            "/api/conversations",
            headers={"X-Session-ID": session_id},
            json={
                "topic": "Test topic",
                "thinkers": [
                    {
                        "name": "Thinker",
                        "bio": "Bio",
                        "positions": "Positions",
                        "style": "Style",
                    },
                ],
            },
        )
        conv_id = conv_response.json()["id"]

        # Get conversation
        response = await client.get(
            f"/api/conversations/{conv_id}",
            headers={"X-Session-ID": session_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == conv_id
        assert "messages" in data
        assert "thinkers" in data

    async def test_get_conversation_not_found(self, client: AsyncClient) -> None:
        """Test getting non-existent conversation."""
        session_response = await client.post("/api/sessions")
        session_id = session_response.json()["id"]

        response = await client.get(
            "/api/conversations/non-existent",
            headers={"X-Session-ID": session_id},
        )
        assert response.status_code == 404

    async def test_send_message(self, client: AsyncClient) -> None:
        """Test sending a user message."""
        # Create session and conversation
        session_response = await client.post("/api/sessions")
        session_id = session_response.json()["id"]

        conv_response = await client.post(
            "/api/conversations",
            headers={"X-Session-ID": session_id},
            json={
                "topic": "Test",
                "thinkers": [
                    {
                        "name": "Thinker",
                        "bio": "Bio",
                        "positions": "Positions",
                        "style": "Style",
                    },
                ],
            },
        )
        conv_id = conv_response.json()["id"]

        # Send message
        response = await client.post(
            f"/api/conversations/{conv_id}/messages",
            headers={"X-Session-ID": session_id},
            json={"content": "Hello, thinkers!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Hello, thinkers!"
        assert data["sender_type"] == "user"


class TestThinkerAPI:
    """Tests for thinker endpoints."""

    async def test_suggest_thinkers(self, client: AsyncClient) -> None:
        """Test getting thinker suggestions."""
        response = await client.post(
            "/api/thinkers/suggest",
            json={"topic": "Philosophy of mind", "count": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert all("name" in t for t in data)
        assert all("profile" in t for t in data)

    async def test_validate_known_thinker(self, client: AsyncClient) -> None:
        """Test validating a known thinker."""
        response = await client.post(
            "/api/thinkers/validate",
            json={"name": "Socrates"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["profile"] is not None

    async def test_validate_unknown_thinker(self, client: AsyncClient) -> None:
        """Test validating an unknown thinker."""
        response = await client.post(
            "/api/thinkers/validate",
            json={"name": "NotARealPerson12345"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert data["error"] is not None
