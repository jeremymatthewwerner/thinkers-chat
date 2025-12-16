"""WebSocket handler for real-time chat messaging."""

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()


class WSMessageType(str, Enum):
    """Types of WebSocket messages."""

    # Client -> Server
    JOIN = "join"
    LEAVE = "leave"
    USER_MESSAGE = "user_message"
    TYPING_START = "typing_start"
    TYPING_STOP = "typing_stop"

    # Server -> Client
    MESSAGE = "message"
    THINKER_TYPING = "thinker_typing"
    THINKER_STOPPED_TYPING = "thinker_stopped_typing"
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    ERROR = "error"


class WSMessage(BaseModel):
    """WebSocket message structure."""

    type: WSMessageType
    conversation_id: str | None = None
    content: str | None = None
    sender_name: str | None = None
    sender_type: str | None = None
    message_id: str | None = None
    timestamp: str | None = None
    cost: float | None = None


@dataclass
class ConversationRoom:
    """Manages WebSocket connections for a conversation."""

    conversation_id: str
    connections: set[WebSocket] = field(default_factory=set)
    is_active: bool = False
    typing_thinkers: set[str] = field(default_factory=set)

    def add_connection(self, websocket: WebSocket) -> None:
        """Add a WebSocket connection to the room."""
        self.connections.add(websocket)
        self.is_active = True

    def remove_connection(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection from the room."""
        self.connections.discard(websocket)
        if not self.connections:
            self.is_active = False

    async def broadcast(self, message: WSMessage) -> None:
        """Broadcast a message to all connected clients."""
        message_data = message.model_dump_json()
        disconnected = set()
        for connection in self.connections:
            try:
                await connection.send_text(message_data)
            except Exception:
                disconnected.add(connection)
        # Clean up disconnected clients
        for conn in disconnected:
            self.connections.discard(conn)
        if not self.connections:
            self.is_active = False


class ConnectionManager:
    """Manages all WebSocket connections across conversations."""

    def __init__(self) -> None:
        self.rooms: dict[str, ConversationRoom] = defaultdict(
            lambda: ConversationRoom(conversation_id="")
        )
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, conversation_id: str) -> None:
        """Accept a new WebSocket connection and add to room."""
        await websocket.accept()
        async with self._lock:
            if conversation_id not in self.rooms:
                self.rooms[conversation_id] = ConversationRoom(conversation_id=conversation_id)
            self.rooms[conversation_id].add_connection(websocket)

    async def disconnect(self, websocket: WebSocket, conversation_id: str) -> None:
        """Remove a WebSocket connection from its room."""
        async with self._lock:
            if conversation_id in self.rooms:
                self.rooms[conversation_id].remove_connection(websocket)

    def is_conversation_active(self, conversation_id: str) -> bool:
        """Check if a conversation has any active connections."""
        return conversation_id in self.rooms and self.rooms[conversation_id].is_active

    async def broadcast_to_conversation(self, conversation_id: str, message: WSMessage) -> None:
        """Broadcast a message to all connections in a conversation."""
        if conversation_id in self.rooms:
            await self.rooms[conversation_id].broadcast(message)

    async def send_thinker_message(
        self,
        conversation_id: str,
        thinker_name: str,
        content: str,
        message_id: str,
        cost: float | None = None,
    ) -> None:
        """Send a thinker's message to the conversation."""
        message = WSMessage(
            type=WSMessageType.MESSAGE,
            conversation_id=conversation_id,
            sender_type="thinker",
            sender_name=thinker_name,
            content=content,
            message_id=message_id,
            timestamp=datetime.now(UTC).isoformat(),
            cost=cost,
        )
        await self.broadcast_to_conversation(conversation_id, message)

    async def send_thinker_typing(self, conversation_id: str, thinker_name: str) -> None:
        """Notify that a thinker is typing."""
        if conversation_id in self.rooms:
            self.rooms[conversation_id].typing_thinkers.add(thinker_name)
        message = WSMessage(
            type=WSMessageType.THINKER_TYPING,
            conversation_id=conversation_id,
            sender_name=thinker_name,
        )
        await self.broadcast_to_conversation(conversation_id, message)

    async def send_thinker_stopped_typing(self, conversation_id: str, thinker_name: str) -> None:
        """Notify that a thinker stopped typing."""
        if conversation_id in self.rooms:
            self.rooms[conversation_id].typing_thinkers.discard(thinker_name)
        message = WSMessage(
            type=WSMessageType.THINKER_STOPPED_TYPING,
            conversation_id=conversation_id,
            sender_name=thinker_name,
        )
        await self.broadcast_to_conversation(conversation_id, message)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: str,
) -> None:
    """WebSocket endpoint for real-time chat messaging.

    Clients connect to this endpoint to receive real-time updates about:
    - New messages from thinkers
    - Typing indicators
    - User join/leave events
    """
    await manager.connect(websocket, conversation_id)

    # Notify others that a user joined
    await manager.broadcast_to_conversation(
        conversation_id,
        WSMessage(
            type=WSMessageType.USER_JOINED,
            conversation_id=conversation_id,
        ),
    )

    try:
        while True:
            # Receive and parse message from client
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type")

                if message_type == WSMessageType.TYPING_START:
                    # User started typing - could be used to pause thinkers
                    pass
                elif message_type == WSMessageType.TYPING_STOP:
                    # User stopped typing
                    pass
                elif message_type == WSMessageType.USER_MESSAGE:
                    # User sent a message - broadcast to all
                    # Note: The actual message storage is handled by the REST API
                    # This is just for real-time notification
                    content = message_data.get("content", "")
                    await manager.broadcast_to_conversation(
                        conversation_id,
                        WSMessage(
                            type=WSMessageType.MESSAGE,
                            conversation_id=conversation_id,
                            sender_type="user",
                            content=content,
                            timestamp=datetime.now(UTC).isoformat(),
                        ),
                    )
            except json.JSONDecodeError:
                await websocket.send_text(
                    WSMessage(
                        type=WSMessageType.ERROR,
                        content="Invalid JSON",
                    ).model_dump_json()
                )

    except WebSocketDisconnect:
        await manager.disconnect(websocket, conversation_id)
        # Notify others that a user left
        await manager.broadcast_to_conversation(
            conversation_id,
            WSMessage(
                type=WSMessageType.USER_LEFT,
                conversation_id=conversation_id,
            ),
        )
