"""API routes for Thinkers Chat."""

from fastapi import APIRouter

from app.api import conversations, sessions, thinkers, websocket

api_router = APIRouter(prefix="/api")

api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(thinkers.router, prefix="/thinkers", tags=["thinkers"])

# WebSocket route (no prefix - uses /ws/{conversation_id})
ws_router = websocket.router
