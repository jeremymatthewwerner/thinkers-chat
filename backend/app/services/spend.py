"""Service for spend tracking and retrieval."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.session import Session as UserSession
from app.models.user import User
from app.schemas.spend import ConversationSpend, SessionSpend, UserSpendData


async def get_user_spend_data(db: AsyncSession, user_id: str) -> UserSpendData | None:
    """Retrieve complete spend data for a user.

    Args:
        db: Async database session
        user_id: ID of the user to get spend data for

    Returns:
        UserSpendData with all spend information, or None if user not found
    """
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    # Get all sessions for user
    sessions_result = await db.execute(select(UserSession).where(UserSession.user_id == user_id))
    sessions = sessions_result.scalars().all()

    # Get conversation spend data with aggregated message costs
    conversation_spend_query = (
        select(
            Conversation.id.label("conversation_id"),
            Conversation.session_id,
            Conversation.title,
            func.coalesce(func.sum(Message.cost), 0.0).label("total_spend"),
            func.count(Message.id).filter(Message.cost.isnot(None)).label("message_count"),
        )
        .join(UserSession, Conversation.session_id == UserSession.id)
        .outerjoin(Message, Conversation.id == Message.conversation_id)
        .where(UserSession.user_id == user_id)
        .group_by(Conversation.id, Conversation.session_id, Conversation.title)
    )

    conv_result = await db.execute(conversation_spend_query)
    conversation_rows = conv_result.all()

    # Build conversation spend list
    conversations = [
        ConversationSpend(
            conversation_id=row.conversation_id,
            session_id=row.session_id,
            title=row.title,
            total_spend=float(row.total_spend),
            message_count=int(row.message_count),
        )
        for row in conversation_rows
    ]

    # Aggregate session spend from conversations
    session_spend_map: dict[str, float] = {}
    session_conv_count: dict[str, int] = {}
    for conv in conversations:
        session_spend_map[conv.session_id] = (
            session_spend_map.get(conv.session_id, 0.0) + conv.total_spend
        )
        session_conv_count[conv.session_id] = session_conv_count.get(conv.session_id, 0) + 1

    # Build session spend list
    session_spends = [
        SessionSpend(
            session_id=session.id,
            total_spend=session_spend_map.get(session.id, 0.0),
            conversation_count=session_conv_count.get(session.id, 0),
        )
        for session in sessions
    ]

    return UserSpendData(
        user_id=user.id,
        username=user.username,
        total_spend=user.total_spend,
        sessions=session_spends,
        conversations=conversations,
    )
