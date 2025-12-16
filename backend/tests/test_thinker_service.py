"""Tests for the ThinkerService."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

from anthropic.types import TextBlock

from app.models.message import SenderType
from app.services.thinker import ThinkerService


class TestThinkerService:
    """Tests for ThinkerService."""

    def test_service_initialization(self) -> None:
        """Test that service initializes correctly."""
        service = ThinkerService()
        assert service._client is None
        assert service._active_tasks == {}

    def test_client_property_without_api_key(self) -> None:
        """Test that client is None without API key."""
        service = ThinkerService()
        # Settings is initialized in __init__ with empty API key by default
        service.settings = MagicMock()
        service.settings.anthropic_api_key = ""
        assert service.client is None


class TestShouldRespond:
    """Tests for the _should_respond method."""

    def test_should_not_respond_to_empty_messages(self) -> None:
        """Test that thinker doesn't respond when there are no messages."""
        service = ThinkerService()
        thinker = MagicMock()
        thinker.name = "Socrates"

        result = service._should_respond(thinker, [], 0)
        assert result is False

    def test_should_not_respond_when_no_new_messages(self) -> None:
        """Test that thinker doesn't respond when no new messages."""
        service = ThinkerService()
        thinker = MagicMock()
        thinker.name = "Socrates"

        messages: Any = [MagicMock(content="Hello", sender_name="User")]

        result = service._should_respond(thinker, messages, 1)
        assert result is False

    def test_low_probability_for_own_message(self) -> None:
        """Test that thinker has low probability to respond to own message."""
        service = ThinkerService()
        thinker = MagicMock()
        thinker.name = "Socrates"

        message = MagicMock()
        message.content = "This is my message"
        message.sender_name = "Socrates"
        messages: Any = [message]

        # Run multiple times to check probability is low
        responses = [service._should_respond(thinker, messages, 0) for _ in range(100)]
        # Should respond less than 20% of the time to own messages
        response_rate = sum(responses) / len(responses)
        assert response_rate < 0.20


class TestSuggestThinkers:
    """Tests for suggest_thinkers method."""

    async def test_suggest_returns_empty_without_client(self) -> None:
        """Test that suggest_thinkers returns empty list without client."""
        service = ThinkerService()
        service._client = None

        result = await service.suggest_thinkers("philosophy", 3)
        assert result == []

    async def test_suggest_with_mock_client(self) -> None:
        """Test suggest_thinkers with mocked API response."""
        service = ThinkerService()

        mock_response = MagicMock()
        mock_response.content = [
            TextBlock(
                type="text",
                text="""[
                {
                    "name": "Socrates",
                    "reason": "Master of questioning",
                    "profile": {
                        "name": "Socrates",
                        "bio": "Ancient Greek philosopher",
                        "positions": "Socratic method",
                        "style": "Questions everything"
                    }
                }
            ]""",
            )
        ]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        service._client = mock_client

        result = await service.suggest_thinkers("philosophy", 1)

        assert len(result) == 1
        assert result[0].name == "Socrates"
        assert result[0].profile.bio == "Ancient Greek philosopher"


class TestValidateThinker:
    """Tests for validate_thinker method."""

    async def test_validate_returns_false_without_client(self) -> None:
        """Test that validate_thinker returns False without client."""
        service = ThinkerService()
        service._client = None

        is_valid, profile = await service.validate_thinker("Socrates")
        assert is_valid is False
        assert profile is None

    async def test_validate_with_valid_response(self) -> None:
        """Test validate_thinker with valid API response."""
        service = ThinkerService()

        mock_response = MagicMock()
        mock_response.content = [
            TextBlock(
                type="text",
                text="""{
                "valid": true,
                "profile": {
                    "name": "Socrates",
                    "bio": "Ancient Greek philosopher",
                    "positions": "Socratic method",
                    "style": "Questions everything"
                }
            }""",
            )
        ]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        service._client = mock_client

        is_valid, profile = await service.validate_thinker("Socrates")

        assert is_valid is True
        assert profile is not None
        assert profile.name == "Socrates"

    async def test_validate_with_invalid_response(self) -> None:
        """Test validate_thinker with invalid API response."""
        service = ThinkerService()

        mock_response = MagicMock()
        mock_response.content = [
            TextBlock(
                type="text",
                text="""{
                "valid": false,
                "reason": "Not a real person"
            }""",
            )
        ]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        service._client = mock_client

        is_valid, profile = await service.validate_thinker("FakePerson123")

        assert is_valid is False
        assert profile is None


class TestGenerateResponse:
    """Tests for generate_response method."""

    async def test_generate_returns_empty_without_client(self) -> None:
        """Test that generate_response returns empty without client."""
        service = ThinkerService()
        service._client = None

        thinker = MagicMock()
        messages: Any = []

        response, cost = await service.generate_response(thinker, messages, "test")
        assert response == ""
        assert cost == 0.0

    async def test_generate_with_mock_response(self) -> None:
        """Test generate_response with mocked API response."""
        service = ThinkerService()

        mock_response = MagicMock()
        mock_response.content = [TextBlock(type="text", text="I think therefore I am.")]
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 10

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        service._client = mock_client

        thinker = MagicMock()
        thinker.name = "Descartes"
        thinker.bio = "French philosopher"
        thinker.positions = "Rationalism"
        thinker.style = "Methodical doubt"

        message = MagicMock()
        message.sender_type = SenderType.USER
        message.sender_name = None
        message.content = "What is the nature of existence?"
        messages: Any = [message]

        response, cost = await service.generate_response(thinker, messages, "philosophy")

        assert response == "I think therefore I am."
        assert cost > 0  # Cost should be calculated


class TestConversationAgents:
    """Tests for conversation agent management."""

    async def test_stop_agents_clears_tasks(self) -> None:
        """Test that stopping agents clears the task dict."""
        import asyncio

        service = ThinkerService()
        conversation_id = "test-conv"

        # Create a real cancelled task
        async def dummy_coro() -> None:
            await asyncio.sleep(100)

        task = asyncio.create_task(dummy_coro())
        service._active_tasks[conversation_id] = {"thinker-1": task}

        await service.stop_conversation_agents(conversation_id)

        assert conversation_id not in service._active_tasks

    async def test_stop_agents_does_nothing_for_unknown_conversation(self) -> None:
        """Test that stopping agents for unknown conversation doesn't error."""
        service = ThinkerService()

        # Should not raise
        await service.stop_conversation_agents("nonexistent")
