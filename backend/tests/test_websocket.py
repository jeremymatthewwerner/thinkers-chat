"""Tests for WebSocket functionality."""

import json

from starlette.testclient import TestClient

from app.api.websocket import ConnectionManager, WSMessage, WSMessageType
from app.core.auth import create_access_token
from app.main import app


def get_test_token(user_id: str = "test-user-id", session_id: str = "test-session-id") -> str:
    """Create a valid JWT token for testing."""
    return create_access_token({"sub": user_id, "session_id": session_id})


class TestConnectionManager:
    """Tests for the ConnectionManager class."""

    def test_manager_initialization(self) -> None:
        """Test that manager initializes correctly."""
        manager = ConnectionManager()
        assert isinstance(manager.rooms, dict)

    def test_is_conversation_active_empty(self) -> None:
        """Test that empty conversation is not active."""
        manager = ConnectionManager()
        assert manager.is_conversation_active("nonexistent") is False


class TestWSMessage:
    """Tests for WSMessage model."""

    def test_message_creation(self) -> None:
        """Test creating a WebSocket message."""
        message = WSMessage(
            type=WSMessageType.MESSAGE,
            conversation_id="conv-123",
            content="Hello!",
            sender_name="Socrates",
            sender_type="thinker",
        )
        assert message.type == WSMessageType.MESSAGE
        assert message.conversation_id == "conv-123"
        assert message.content == "Hello!"

    def test_message_serialization(self) -> None:
        """Test message JSON serialization."""
        message = WSMessage(
            type=WSMessageType.THINKER_TYPING,
            conversation_id="conv-123",
            sender_name="Einstein",
        )
        json_str = message.model_dump_json()
        data = json.loads(json_str)
        assert data["type"] == "thinker_typing"
        assert data["sender_name"] == "Einstein"

    def test_message_types(self) -> None:
        """Test all message types are valid."""
        for msg_type in WSMessageType:
            message = WSMessage(type=msg_type)
            assert message.type == msg_type


class TestWebSocketEndpoint:
    """Tests for WebSocket endpoint."""

    def test_websocket_connect(self) -> None:
        """Test WebSocket connection."""
        token = get_test_token()
        with (
            TestClient(app) as test_client,
            test_client.websocket_connect(f"/ws/test-conversation?token={token}") as websocket,
        ):
            # Should receive user_joined message
            data = websocket.receive_json()
            assert data["type"] == "user_joined"
            assert data["conversation_id"] == "test-conversation"

    def test_websocket_send_message(self) -> None:
        """Test sending a message via WebSocket."""
        token = get_test_token()
        with (
            TestClient(app) as test_client,
            test_client.websocket_connect(f"/ws/test-conversation?token={token}") as websocket,
        ):
            # Skip the join message
            websocket.receive_json()

            # Send a user message
            websocket.send_json(
                {
                    "type": "user_message",
                    "content": "Hello, thinkers!",
                }
            )

            # Should receive the message broadcast back
            data = websocket.receive_json()
            assert data["type"] == "message"
            assert data["content"] == "Hello, thinkers!"
            assert data["sender_type"] == "user"

    def test_websocket_invalid_json(self) -> None:
        """Test handling invalid JSON."""
        token = get_test_token()
        with (
            TestClient(app) as test_client,
            test_client.websocket_connect(f"/ws/test-conversation?token={token}") as websocket,
        ):
            # Skip the join message
            websocket.receive_json()

            # Send invalid JSON
            websocket.send_text("not valid json")

            # Should receive error message
            data = websocket.receive_json()
            assert data["type"] == "error"
            assert "Invalid JSON" in data["content"]

    def test_multiple_clients_receive_messages(self) -> None:
        """Test that multiple clients receive broadcast messages."""
        token1 = get_test_token("user-1")
        token2 = get_test_token("user-2")
        with TestClient(app) as test_client, test_client.websocket_connect(f"/ws/multi-test?token={token1}") as ws1:
            # Skip join message for ws1
            ws1.receive_json()

            with test_client.websocket_connect(f"/ws/multi-test?token={token2}") as ws2:
                # ws1 should receive user_joined for ws2
                data = ws1.receive_json()
                assert data["type"] == "user_joined"

                # ws2 should receive its own user_joined
                data = ws2.receive_json()
                assert data["type"] == "user_joined"

                # ws1 sends a message
                ws1.send_json(
                    {
                        "type": "user_message",
                        "content": "Hello from ws1!",
                    }
                )

                # Both should receive the broadcast
                data1 = ws1.receive_json()
                data2 = ws2.receive_json()

                assert data1["type"] == "message"
                assert data1["content"] == "Hello from ws1!"
                assert data2["type"] == "message"
                assert data2["content"] == "Hello from ws1!"


class TestWebSocketMessageTypes:
    """Tests for different WebSocket message types."""

    def test_typing_start_message(self) -> None:
        """Test typing_start message type."""
        token = get_test_token()
        with (
            TestClient(app) as test_client,
            test_client.websocket_connect(f"/ws/typing-test?token={token}") as websocket,
        ):
            # Skip join message
            websocket.receive_json()

            # Send typing start
            websocket.send_json({"type": "typing_start"})

            # No response expected for typing_start (it's just a signal)
            # The test passes if no error is raised

    def test_typing_stop_message(self) -> None:
        """Test typing_stop message type."""
        token = get_test_token()
        with (
            TestClient(app) as test_client,
            test_client.websocket_connect(f"/ws/typing-test?token={token}") as websocket,
        ):
            # Skip join message
            websocket.receive_json()

            # Send typing stop
            websocket.send_json({"type": "typing_stop"})

            # No response expected for typing_stop
            # The test passes if no error is raised
