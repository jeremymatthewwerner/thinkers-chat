"""Test helper endpoints for integration testing.

These endpoints are only used in test environments to trigger specific error conditions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.websocket import WSMessage, WSMessageType, manager
from app.core.config import is_test_mode
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
    """Test endpoint that sends ERROR type WebSocket messages to a conversation.

    This endpoint is only available when TEST_MODE=true and is used by E2E tests
    to verify error handling in the frontend.

    Args:
        request: Contains conversation_id and error_message

    Returns:
        Success message confirming the error was broadcast

    Raises:
        HTTPException: 403 if not in test mode, 404 if conversation not found
    """
    if not is_test_mode():
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available in test mode",
        )

    # Check if conversation has active connections
    if not manager.is_conversation_active(request.conversation_id):
        raise HTTPException(
            status_code=404,
            detail=f"No active connections for conversation {request.conversation_id}",
        )

    # Broadcast ERROR message to all connections in the conversation
    error_ws_message = WSMessage(
        type=WSMessageType.ERROR,
        conversation_id=request.conversation_id,
        content=request.error_message,
    )

    await manager.broadcast_to_conversation(request.conversation_id, error_ws_message)

    return {
        "status": "success",
        "message": f"Error message broadcast to conversation {request.conversation_id}",
    }
