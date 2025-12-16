"""API routes for conversation management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.sessions import get_or_create_session
from app.core.database import get_db
from app.models import Conversation, ConversationThinker, Message, Session
from app.models.message import SenderType
from app.schemas import (
    ConversationCreate,
    ConversationResponse,
    ConversationWithMessages,
    MessageCreate,
    MessageResponse,
)

router = APIRouter()


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    """Create a new conversation with thinkers."""
    # Create conversation
    conversation = Conversation(
        session_id=session.id,
        topic=data.topic,
    )
    db.add(conversation)
    await db.flush()

    # Add thinkers to conversation
    colors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"]
    for i, thinker_data in enumerate(data.thinkers):
        thinker = ConversationThinker(
            conversation_id=conversation.id,
            name=thinker_data.name,
            bio=thinker_data.bio,
            positions=thinker_data.positions,
            style=thinker_data.style,
            color=thinker_data.color
            if thinker_data.color != "#6366f1"
            else colors[i % len(colors)],
        )
        db.add(thinker)

    await db.flush()

    # Reload with thinkers
    await db.refresh(conversation, attribute_names=["thinkers"])
    return conversation


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    """List all conversations for the current session."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.session_id == session.id)
        .options(selectinload(Conversation.thinkers))
        .order_by(Conversation.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: str,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    """Get a conversation with its messages."""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.session_id == session.id,
        )
        .options(
            selectinload(Conversation.thinkers),
            selectinload(Conversation.messages),
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    data: MessageCreate,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
) -> Message:
    """Send a user message to a conversation."""
    # Verify conversation exists and belongs to session
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.session_id == session.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_type=SenderType.USER,
        content=data.content,
    )
    db.add(message)
    await db.flush()

    return message
