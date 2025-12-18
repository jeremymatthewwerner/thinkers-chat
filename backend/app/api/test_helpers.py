"""Test helper endpoints for integration testing.

These endpoints are only used in test environments to trigger specific error conditions.
"""

from fastapi import APIRouter

from app.exceptions import BillingError

router = APIRouter(prefix="/test")


@router.get("/billing-error")
async def trigger_billing_error() -> None:
    """Test endpoint that raises BillingError for integration testing.

    This endpoint is used by integration tests to verify that:
    1. BillingError exception is properly caught by the exception handler
    2. HTTP 503 response is returned
    3. GitHub issue filing is triggered in background
    """
    raise BillingError("Test billing error for integration testing")
