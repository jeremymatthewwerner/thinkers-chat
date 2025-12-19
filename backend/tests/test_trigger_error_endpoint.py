"""Unit tests for the trigger-error test helper endpoint."""

from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.websocket import WSMessage, WSMessageType
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
async def client(engine: AsyncEngine) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database override."""
    async_session_maker = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with async_session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)  # type: ignore
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_trigger_error_endpoint_exists(client: AsyncClient) -> None:
    """Test that /api/test/trigger-error endpoint exists and accepts requests."""
    # Arrange: Mock the WebSocket manager to avoid needing a real conversation
    with patch("app.api.test_helpers.manager.broadcast_to_conversation", new_callable=AsyncMock):
        # Act: Call the endpoint with test data
        response = await client.post(
            "/api/test/trigger-error",
            json={
                "conversation_id": "test-conv-123",
                "error_message": "Test error message",
            },
        )

        # Assert: Verify 200 OK response
        assert response.status_code == 200

        # Assert: Verify response contains status and conversation_id
        response_json = response.json()
        assert "status" in response_json
        assert response_json["status"] == "error_sent"
        assert "conversation_id" in response_json
        assert response_json["conversation_id"] == "test-conv-123"


@pytest.mark.asyncio
async def test_trigger_error_sends_websocket_message(client: AsyncClient) -> None:
    """Test that trigger-error endpoint sends ERROR WebSocket message."""
    # Arrange: Mock the WebSocket manager
    with patch(
        "app.api.test_helpers.manager.broadcast_to_conversation", new_callable=AsyncMock
    ) as mock_broadcast:
        # Act: Call the endpoint
        await client.post(
            "/api/test/trigger-error",
            json={
                "conversation_id": "test-conv-456",
                "error_message": "Billing quota exceeded",
            },
        )

        # Assert: Verify broadcast_to_conversation was called
        mock_broadcast.assert_called_once()

        # Assert: Verify the correct arguments were passed
        call_args = mock_broadcast.call_args
        conversation_id = call_args[0][0]
        message = call_args[0][1]

        assert conversation_id == "test-conv-456"
        assert isinstance(message, WSMessage)
        assert message.type == WSMessageType.ERROR
        assert message.conversation_id == "test-conv-456"
        assert message.content == "Billing quota exceeded"


@pytest.mark.asyncio
async def test_trigger_error_requires_conversation_id(client: AsyncClient) -> None:
    """Test that trigger-error endpoint requires conversation_id."""
    # Act: Call endpoint without conversation_id
    response = await client.post(
        "/api/test/trigger-error",
        json={
            "error_message": "Test error",
        },
    )

    # Assert: Verify 422 Unprocessable Entity (validation error)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_trigger_error_requires_error_message(client: AsyncClient) -> None:
    """Test that trigger-error endpoint requires error_message."""
    # Act: Call endpoint without error_message
    response = await client.post(
        "/api/test/trigger-error",
        json={
            "conversation_id": "test-conv-789",
        },
    )

    # Assert: Verify 422 Unprocessable Entity (validation error)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_trigger_error_with_empty_strings(client: AsyncClient) -> None:
    """Test that trigger-error endpoint handles empty strings."""
    # Arrange: Mock the WebSocket manager
    with patch(
        "app.api.test_helpers.manager.broadcast_to_conversation", new_callable=AsyncMock
    ) as mock_broadcast:
        # Act: Call endpoint with empty strings (should still work)
        response = await client.post(
            "/api/test/trigger-error",
            json={
                "conversation_id": "",
                "error_message": "",
            },
        )

        # Assert: Verify 200 OK (empty strings are valid)
        assert response.status_code == 200
        mock_broadcast.assert_called_once()
