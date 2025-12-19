"""Test helper endpoints for integration testing.

These endpoints are only used in test environments to trigger specific error conditions.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.websocket import WSMessage, WSMessageType, manager
from app.exceptions import BillingError

router = APIRouter(prefix="/test")


class TriggerErrorRequest(BaseModel):
    """Request body for trigger-error endpoint."""

    conversation_id: str
    error_message: str


@router.get("/billing-error")
async def trigger_billing_error() -> None:
    """Test endpoint that raises BillingError for integration testing.

    This endpoint is used by integration tests to verify that:
    1. BillingError exception is properly caught by the exception handler
    2. HTTP 503 response is returned
    3. GitHub issue filing is triggered in background
    """
    raise BillingError("Test billing error for integration testing")


@router.post("/trigger-error")
async def trigger_error(request: TriggerErrorRequest) -> dict[str, str]:
    """Test endpoint that sends an ERROR WebSocket message to a conversation.

    This endpoint is used by E2E tests to trigger error conditions and verify
    that the frontend properly displays error messages received via WebSocket.

    Args:
        request: Contains conversation_id and error_message

    Returns:
        Success message indicating the error was sent
    """
    # Send ERROR message via WebSocket to the specified conversation
    await manager.broadcast_to_conversation(
        request.conversation_id,
        WSMessage(
            type=WSMessageType.ERROR,
            conversation_id=request.conversation_id,
            content=request.error_message,
        ),
    )

    return {"status": "error_sent", "conversation_id": request.conversation_id}
