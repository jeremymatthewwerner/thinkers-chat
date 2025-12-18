"""Spend tracking models for API cost tracking."""

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.session import Session
    from app.models.user import User


class UserLimits(Base, TimestampMixin):
    """User-specific spend limits.

    Defines per-user configurable limits for session, thread, and total spend.
    Admin users can configure these limits. Defaults: session=1.0, thread=2.0, user=5.0.
    """

    __tablename__ = "user_limits"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    session_limit: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
    )
    thread_limit: Mapped[float] = mapped_column(
        Float,
        default=2.0,
        nullable=False,
    )
    user_limit: Mapped[float] = mapped_column(
        Float,
        default=5.0,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="limits",
    )


class SessionSpend(Base, TimestampMixin):
    """Tracks total API spend per session.

    Each session has a spend tracker that accumulates costs from all
    conversations in that session.
    """

    __tablename__ = "session_spend"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    total_spend: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    # Relationships
    session: Mapped["Session"] = relationship(
        "Session",
        back_populates="spend",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="session_spends",
    )


class ThreadSpend(Base, TimestampMixin):
    """Tracks total API spend per thread (conversation).

    Each conversation/thread has a spend tracker that accumulates costs
    from all messages in that conversation.
    """

    __tablename__ = "thread_spend"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    total_spend: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="spend",
    )
    session: Mapped["Session"] = relationship(
        "Session",
        back_populates="thread_spends",
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="thread_spends",
    )
