"""Session model for anonymous user sessions."""

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Session(Base, TimestampMixin):
    """Anonymous user session.

    Users don't need to authenticate - each browser session gets a unique ID
    stored in localStorage. This model tracks sessions for conversation ownership.
    """

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )

    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation",
        back_populates="session",
        cascade="all, delete-orphan",
    )
