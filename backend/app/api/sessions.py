"""API routes for session management."""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Session
from app.schemas import SessionResponse

router = APIRouter()


async def get_or_create_session(
    x_session_id: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Session:
    """Get existing session or create a new one.

    Sessions are identified by a UUID sent in the X-Session-ID header.
    If no header is provided or session doesn't exist, a new one is created.
    """
    if x_session_id:
        result = await db.execute(select(Session).where(Session.id == x_session_id))
        session = result.scalar_one_or_none()
        if session:
            return session

    # Create new session
    session = Session()
    db.add(session)
    await db.flush()
    return session


@router.post("", response_model=SessionResponse)
async def create_session(
    db: AsyncSession = Depends(get_db),
) -> Session:
    """Create a new anonymous session."""
    session = Session()
    db.add(session)
    await db.flush()
    return session


@router.get("/me", response_model=SessionResponse)
async def get_current_session(
    x_session_id: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> Session:
    """Get current session by ID."""
    result = await db.execute(select(Session).where(Session.id == x_session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
