"""Thinker service for LLM-powered thinker interactions."""

import asyncio
import contextlib
import random
from collections.abc import Awaitable, Callable, Sequence
from typing import TYPE_CHECKING

from anthropic import AsyncAnthropic
from anthropic.types import TextBlock

from app.api.websocket import manager
from app.core.config import get_settings
from app.schemas import ThinkerProfile, ThinkerSuggestion

if TYPE_CHECKING:
    from app.models import ConversationThinker, Message

# Cost per token (approximate for Claude 3.5 Sonnet)
INPUT_COST_PER_TOKEN = 0.000003  # $3 per million input tokens
OUTPUT_COST_PER_TOKEN = 0.000015  # $15 per million output tokens


class ThinkerService:
    """Service for thinker suggestions, validation, and conversation simulation."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: AsyncAnthropic | None = None
        self._active_tasks: dict[str, dict[str, asyncio.Task[None]]] = {}

    @property
    def client(self) -> AsyncAnthropic | None:
        """Get the Anthropic client, creating it if needed."""
        if self._client is None and self.settings.anthropic_api_key:
            self._client = AsyncAnthropic(api_key=self.settings.anthropic_api_key)
        return self._client

    async def suggest_thinkers(self, topic: str, count: int = 3) -> list[ThinkerSuggestion]:
        """Suggest diverse thinkers for a given topic.

        Uses Claude to suggest thinkers who would have interesting,
        diverse perspectives on the topic.
        """
        if not self.client:
            return []

        prompt = f"""Suggest {count} historical or contemporary thinkers who would have interesting and diverse perspectives on this topic: "{topic}"

For each thinker, provide:
1. Their full name
2. A brief reason why they would be interesting for this discussion (1-2 sentences)
3. A profile including:
   - Bio: A 2-3 sentence biographical summary
   - Positions: Their known positions and beliefs relevant to the topic (2-3 sentences)
   - Style: How they communicate - their rhetorical style, tone, and manner (1-2 sentences)

Aim for diversity: include people from different eras, backgrounds, and viewpoints.
People who might disagree with each other make for more interesting discussions.

Format your response as JSON with this structure:
[
  {{
    "name": "Full Name",
    "reason": "Why they're interesting for this topic",
    "profile": {{
      "name": "Full Name",
      "bio": "Biographical summary",
      "positions": "Their positions and beliefs",
      "style": "Communication style"
    }}
  }}
]

Return ONLY the JSON array, no other text."""

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )

            # Parse the response
            import json

            first_block = response.content[0]
            if not isinstance(first_block, TextBlock):
                return []
            content = first_block.text
            data = json.loads(content)

            return [
                ThinkerSuggestion(
                    name=item["name"],
                    reason=item["reason"],
                    profile=ThinkerProfile(**item["profile"]),
                )
                for item in data
            ]
        except Exception:
            return []

    async def validate_thinker(self, name: str) -> tuple[bool, ThinkerProfile | None]:
        """Validate that a name refers to a real historical/contemporary figure.

        Returns (is_valid, profile) where profile is populated if valid.
        """
        if not self.client:
            return False, None

        prompt = f"""Is "{name}" a real historical or contemporary figure who is notable enough to be discussed?

If YES, respond with a JSON object:
{{
  "valid": true,
  "profile": {{
    "name": "Their correct full name",
    "bio": "A 2-3 sentence biographical summary",
    "positions": "Their known positions and beliefs (2-3 sentences)",
    "style": "How they communicate - their rhetorical style, tone, manner (1-2 sentences)"
  }}
}}

If NO (fictional, unknown, or too obscure), respond with:
{{
  "valid": false,
  "reason": "Brief explanation why"
}}

Return ONLY the JSON, no other text."""

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )

            import json

            first_block = response.content[0]
            if not isinstance(first_block, TextBlock):
                return False, None
            content = first_block.text
            data = json.loads(content)

            if data.get("valid"):
                return True, ThinkerProfile(**data["profile"])
            return False, None
        except Exception:
            return False, None

    async def generate_response(
        self,
        thinker: "ConversationThinker",
        messages: Sequence["Message"],
        topic: str,
    ) -> tuple[str, float]:
        """Generate a response from a thinker given the conversation context.

        Returns (response_text, cost).
        """
        if not self.client:
            return "", 0.0

        # Build conversation context
        conversation_history = "\n".join(
            f"{'User' if m.sender_type.value == 'user' else m.sender_name}: {m.content}"
            for m in messages[-20:]  # Last 20 messages for context
        )

        prompt = f"""You are simulating {thinker.name} in a group discussion.

ABOUT {thinker.name.upper()}:
Bio: {thinker.bio}
Known positions: {thinker.positions}
Communication style: {thinker.style}

DISCUSSION TOPIC: {topic}

CONVERSATION SO FAR:
{conversation_history}

Now respond as {thinker.name} would. Guidelines:
- Stay in character based on their known views and communication style
- Use modern English regardless of their era
- If discussing something that didn't exist in their time, acknowledge it (e.g., "In my era we didn't have X, but...")
- Engage with what others have said - agree, disagree, build on ideas
- Be concise but substantive (2-4 sentences typically)
- Don't be preachy or lecture-like
- Show personality through your response style

Respond with ONLY what {thinker.name} would say, nothing else."""

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )

            # Calculate cost
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            cost = input_tokens * INPUT_COST_PER_TOKEN + output_tokens * OUTPUT_COST_PER_TOKEN

            first_block = response.content[0]
            if not isinstance(first_block, TextBlock):
                return "", 0.0
            return first_block.text, cost
        except Exception:
            return "", 0.0

    async def start_conversation_agents(
        self,
        conversation_id: str,
        thinkers: list["ConversationThinker"],
        topic: str,
        get_messages: Callable[[str], Awaitable[Sequence["Message"]]],
        save_message: Callable[[str, str, str, float], Awaitable["Message"]],
    ) -> None:
        """Start thinker agents for a conversation.

        Each thinker runs as an independent async task that:
        - Monitors the conversation
        - Decides when to respond
        - Generates and sends responses
        """
        if conversation_id in self._active_tasks:
            # Stop existing tasks first
            await self.stop_conversation_agents(conversation_id)

        self._active_tasks[conversation_id] = {}

        for thinker in thinkers:
            task = asyncio.create_task(
                self._run_thinker_agent(
                    conversation_id,
                    thinker,
                    topic,
                    get_messages,
                    save_message,
                )
            )
            self._active_tasks[conversation_id][thinker.id] = task

    async def stop_conversation_agents(self, conversation_id: str) -> None:
        """Stop all thinker agents for a conversation."""
        if conversation_id in self._active_tasks:
            for task in self._active_tasks[conversation_id].values():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            del self._active_tasks[conversation_id]

    async def _run_thinker_agent(
        self,
        conversation_id: str,
        thinker: "ConversationThinker",
        topic: str,
        get_messages: Callable[[str], Awaitable[Sequence["Message"]]],
        save_message: Callable[[str, str, str, float], Awaitable["Message"]],
    ) -> None:
        """Run a single thinker agent.

        The agent monitors the conversation and responds when appropriate.
        It pauses when no users are connected and resumes when they return.
        """
        last_response_count = 0

        while True:
            try:
                # Check if conversation is active (users connected)
                if not manager.is_conversation_active(conversation_id):
                    # Wait for users to reconnect
                    await asyncio.sleep(1)
                    continue

                # Get current messages
                messages = await get_messages(conversation_id)

                # Decide whether to respond
                should_respond = self._should_respond(thinker, messages, last_response_count)

                if should_respond:
                    # Show typing indicator
                    await manager.send_thinker_typing(conversation_id, thinker.name)

                    # Simulate typing delay (more natural)
                    typing_delay = random.uniform(2.0, 5.0)
                    await asyncio.sleep(typing_delay)

                    # Generate response
                    response_text, cost = await self.generate_response(thinker, messages, topic)

                    if response_text:
                        # Save and broadcast the message
                        message = await save_message(
                            conversation_id,
                            thinker.name,
                            response_text,
                            cost,
                        )

                        await manager.send_thinker_stopped_typing(conversation_id, thinker.name)
                        await manager.send_thinker_message(
                            conversation_id,
                            thinker.name,
                            response_text,
                            message.id,
                            cost,
                        )

                        last_response_count = len(messages) + 1
                    else:
                        await manager.send_thinker_stopped_typing(conversation_id, thinker.name)

                # Wait before checking again
                wait_time = random.uniform(3.0, 8.0)
                await asyncio.sleep(wait_time)

            except asyncio.CancelledError:
                break
            except Exception:
                # Log error but continue running
                await asyncio.sleep(5)

    def _should_respond(
        self,
        thinker: "ConversationThinker",
        messages: Sequence["Message"],
        last_response_count: int,
    ) -> bool:
        """Decide if a thinker should respond to the current conversation state.

        Uses heuristics to create natural conversation flow:
        - Respond after new messages arrive
        - Don't respond too frequently
        - Higher chance to respond when addressed or when topic is relevant
        """
        if not messages:
            return False

        # New messages since last response
        new_message_count = len(messages) - last_response_count
        if new_message_count <= 0:
            return False

        # Check if the thinker was addressed
        last_messages = messages[-3:]
        was_addressed = any(thinker.name.lower() in m.content.lower() for m in last_messages)

        # Base probability increases with new messages
        base_probability = min(0.3 + (new_message_count * 0.15), 0.8)

        # Higher probability if addressed
        if was_addressed:
            base_probability = min(base_probability + 0.4, 0.95)

        # Don't respond to your own message immediately
        if messages and messages[-1].sender_name == thinker.name:
            base_probability = 0.1

        return random.random() < base_probability


# Global service instance
thinker_service = ThinkerService()
