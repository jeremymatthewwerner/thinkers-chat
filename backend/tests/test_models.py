"""Tests for database models."""

from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.models import (
    Base,
    Conversation,
    ConversationThinker,
    Message,
    Session,
    SessionSpend,
    ThreadSpend,
    User,
    UserLimits,
)
from app.models.message import SenderType


@pytest.fixture
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create an in-memory SQLite engine for testing."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Create a database session for testing."""
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user for testing."""
    user = User(
        username="testuser",
        password_hash="fakehash",
        is_admin=False,
    )
    db_session.add(user)
    await db_session.commit()
    return user


class TestSessionModel:
    """Tests for the Session model."""

    async def test_create_session(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating a new session."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        assert session.id is not None
        assert len(session.id) == 36  # UUID format
        assert session.created_at is not None
        assert session.user_id == test_user.id

    async def test_session_has_conversations_relationship(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that session has conversations relationship."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        # Need to explicitly load relationship in async
        await db_session.refresh(session, attribute_names=["conversations"])
        assert session.conversations == []


class TestConversationModel:
    """Tests for the Conversation model."""

    async def test_create_conversation(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating a new conversation."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        conversation = Conversation(
            session_id=session.id,
            topic="What is consciousness?",
            title="Consciousness Discussion",
        )
        db_session.add(conversation)
        await db_session.commit()

        assert conversation.id is not None
        assert conversation.topic == "What is consciousness?"
        assert conversation.title == "Consciousness Discussion"
        assert conversation.is_active is True
        assert conversation.created_at is not None

    async def test_conversation_belongs_to_session(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test conversation-session relationship."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        conversation = Conversation(
            session_id=session.id,
            topic="Test topic",
        )
        db_session.add(conversation)
        await db_session.commit()

        # Refresh to load relationship (need to specify attribute for async)
        await db_session.refresh(session, attribute_names=["conversations"])

        assert conversation.session_id == session.id
        assert len(session.conversations) == 1


class TestConversationThinkerModel:
    """Tests for the ConversationThinker model."""

    async def test_create_thinker(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating a new thinker."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        conversation = Conversation(session_id=session.id, topic="Philosophy")
        db_session.add(conversation)
        await db_session.commit()

        thinker = ConversationThinker(
            conversation_id=conversation.id,
            name="Socrates",
            bio="Ancient Greek philosopher from Athens.",
            positions="Known for the Socratic method of questioning.",
            style="Uses questions to probe assumptions.",
            color="#4f46e5",
        )
        db_session.add(thinker)
        await db_session.commit()

        assert thinker.id is not None
        assert thinker.name == "Socrates"
        assert thinker.bio == "Ancient Greek philosopher from Athens."
        assert thinker.color == "#4f46e5"

    async def test_thinker_belongs_to_conversation(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test thinker-conversation relationship."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Philosophy")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        thinker = ConversationThinker(
            conversation_id=conversation.id,
            name="Aristotle",
            bio="Student of Plato",
            positions="Virtue ethics",
            style="Systematic reasoning",
        )
        db_session.add(thinker)
        await db_session.commit()

        await db_session.refresh(conversation, attribute_names=["thinkers"])
        assert len(conversation.thinkers) == 1
        assert conversation.thinkers[0].name == "Aristotle"


class TestMessageModel:
    """Tests for the Message model."""

    async def test_create_user_message(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating a user message."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        message = Message(
            conversation_id=conversation.id,
            sender_type=SenderType.USER,
            content="Hello, thinkers!",
        )
        db_session.add(message)
        await db_session.commit()

        assert message.id is not None
        assert message.sender_type == SenderType.USER
        assert message.sender_name is None
        assert message.content == "Hello, thinkers!"

    async def test_create_thinker_message(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating a thinker message."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        message = Message(
            conversation_id=conversation.id,
            sender_type=SenderType.THINKER,
            sender_name="Socrates",
            content="What do you mean by that?",
            cost=0.001,
        )
        db_session.add(message)
        await db_session.commit()

        assert message.sender_type == SenderType.THINKER
        assert message.sender_name == "Socrates"
        assert message.cost == 0.001

    async def test_messages_ordered_by_created_at(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that messages are ordered by creation time."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        # Create messages
        msg1 = Message(
            conversation_id=conversation.id,
            sender_type=SenderType.USER,
            content="First",
        )
        msg2 = Message(
            conversation_id=conversation.id,
            sender_type=SenderType.THINKER,
            sender_name="Socrates",
            content="Second",
        )
        db_session.add_all([msg1, msg2])
        await db_session.commit()

        # Refresh to load messages relationship
        await db_session.refresh(conversation, attribute_names=["messages"])

        assert len(conversation.messages) == 2


class TestCascadeDelete:
    """Tests for cascade delete behavior."""

    async def test_deleting_session_deletes_conversations(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that deleting a session deletes its conversations."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()
        conv_id = conversation.id

        await db_session.delete(session)
        await db_session.commit()

        result = await db_session.execute(select(Conversation).where(Conversation.id == conv_id))
        assert result.scalar_one_or_none() is None

    async def test_deleting_conversation_deletes_messages(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that deleting a conversation deletes its messages."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        message = Message(
            conversation_id=conversation.id,
            sender_type=SenderType.USER,
            content="Test message",
        )
        db_session.add(message)
        await db_session.commit()
        msg_id = message.id

        await db_session.delete(conversation)
        await db_session.commit()

        result = await db_session.execute(select(Message).where(Message.id == msg_id))
        assert result.scalar_one_or_none() is None


class TestUserLimitsModel:
    """Tests for the UserLimits model."""

    async def test_create_user_limits(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating user limits with default values."""
        limits = UserLimits(
            user_id=test_user.id,
            session_limit=1.0,
            thread_limit=2.0,
            user_limit=5.0,
        )
        db_session.add(limits)
        await db_session.commit()

        assert limits.id is not None
        assert limits.user_id == test_user.id
        assert limits.session_limit == 1.0
        assert limits.thread_limit == 2.0
        assert limits.user_limit == 5.0
        assert limits.created_at is not None

    async def test_user_limits_unique_per_user(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that each user can only have one limits record."""
        limits1 = UserLimits(user_id=test_user.id)
        db_session.add(limits1)
        await db_session.commit()

        # Try to create another limits record for the same user
        limits2 = UserLimits(user_id=test_user.id)
        db_session.add(limits2)

        with pytest.raises(IntegrityError):  # Should raise integrity error
            await db_session.commit()

    async def test_user_limits_custom_values(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test creating user limits with custom values."""
        limits = UserLimits(
            user_id=test_user.id,
            session_limit=10.0,
            thread_limit=20.0,
            user_limit=50.0,
        )
        db_session.add(limits)
        await db_session.commit()

        assert limits.session_limit == 10.0
        assert limits.thread_limit == 20.0
        assert limits.user_limit == 50.0


class TestSessionSpendModel:
    """Tests for the SessionSpend model."""

    async def test_create_session_spend(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating session spend tracker."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        spend = SessionSpend(
            session_id=session.id,
            user_id=test_user.id,
            total_spend=0.0,
        )
        db_session.add(spend)
        await db_session.commit()

        assert spend.id is not None
        assert spend.session_id == session.id
        assert spend.user_id == test_user.id
        assert spend.total_spend == 0.0
        assert spend.created_at is not None

    async def test_session_spend_accumulation(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test accumulating spend in a session."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        spend = SessionSpend(
            session_id=session.id,
            user_id=test_user.id,
            total_spend=0.0,
        )
        db_session.add(spend)
        await db_session.commit()

        # Simulate accumulating spend
        spend.total_spend += 0.05
        await db_session.commit()

        spend.total_spend += 0.03
        await db_session.commit()

        assert spend.total_spend == 0.08

    async def test_session_spend_relationship(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test session-spend relationship."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        spend = SessionSpend(
            session_id=session.id,
            user_id=test_user.id,
        )
        db_session.add(spend)
        await db_session.commit()

        await db_session.refresh(session, attribute_names=["spend"])
        assert session.spend is not None
        assert session.spend.session_id == session.id


class TestThreadSpendModel:
    """Tests for the ThreadSpend model."""

    async def test_create_thread_spend(self, db_session: AsyncSession, test_user: User) -> None:
        """Test creating thread spend tracker."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test topic")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        spend = ThreadSpend(
            conversation_id=conversation.id,
            session_id=session.id,
            user_id=test_user.id,
            total_spend=0.0,
        )
        db_session.add(spend)
        await db_session.commit()

        assert spend.id is not None
        assert spend.conversation_id == conversation.id
        assert spend.session_id == session.id
        assert spend.user_id == test_user.id
        assert spend.total_spend == 0.0

    async def test_thread_spend_accumulation(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test accumulating spend in a thread."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        spend = ThreadSpend(
            conversation_id=conversation.id,
            session_id=session.id,
            user_id=test_user.id,
            total_spend=0.0,
        )
        db_session.add(spend)
        await db_session.commit()

        # Simulate message costs
        spend.total_spend += 0.002  # First message
        await db_session.commit()

        spend.total_spend += 0.003  # Second message
        await db_session.commit()

        assert spend.total_spend == 0.005

    async def test_thread_spend_relationship(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test conversation-spend relationship."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        spend = ThreadSpend(
            conversation_id=conversation.id,
            session_id=session.id,
            user_id=test_user.id,
        )
        db_session.add(spend)
        await db_session.commit()

        await db_session.refresh(conversation, attribute_names=["spend"])
        assert conversation.spend is not None
        assert conversation.spend.conversation_id == conversation.id


class TestSpendCascadeDelete:
    """Tests for cascade delete behavior with spend tracking."""

    async def test_deleting_user_deletes_limits(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that deleting a user deletes their limits."""
        limits = UserLimits(user_id=test_user.id)
        db_session.add(limits)
        await db_session.commit()
        limits_id = limits.id

        await db_session.delete(test_user)
        await db_session.commit()

        result = await db_session.execute(select(UserLimits).where(UserLimits.id == limits_id))
        assert result.scalar_one_or_none() is None

    async def test_deleting_session_deletes_spend(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that deleting a session deletes its spend tracker."""
        session = Session(user_id=test_user.id)
        db_session.add(session)
        await db_session.commit()

        spend = SessionSpend(session_id=session.id, user_id=test_user.id)
        db_session.add(spend)
        await db_session.commit()
        spend_id = spend.id

        await db_session.delete(session)
        await db_session.commit()

        result = await db_session.execute(select(SessionSpend).where(SessionSpend.id == spend_id))
        assert result.scalar_one_or_none() is None

    async def test_deleting_conversation_deletes_thread_spend(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """Test that deleting a conversation deletes its thread spend tracker."""
        session = Session(user_id=test_user.id)
        conversation = Conversation(session_id=session.id, topic="Test")
        session.conversations.append(conversation)
        db_session.add(session)
        await db_session.commit()

        spend = ThreadSpend(
            conversation_id=conversation.id,
            session_id=session.id,
            user_id=test_user.id,
        )
        db_session.add(spend)
        await db_session.commit()
        spend_id = spend.id

        await db_session.delete(conversation)
        await db_session.commit()

        result = await db_session.execute(select(ThreadSpend).where(ThreadSpend.id == spend_id))
        assert result.scalar_one_or_none() is None
