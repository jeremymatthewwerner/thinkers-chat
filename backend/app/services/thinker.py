"""Thinker service for LLM-powered thinker interactions."""

import asyncio
import contextlib
import logging
import random
from collections.abc import Awaitable, Callable, Sequence
from typing import TYPE_CHECKING

import httpx
from anthropic import APIError, AsyncAnthropic
from anthropic.types import TextBlock, ThinkingBlock

from app.api.websocket import manager
from app.core.config import get_settings
from app.schemas import ThinkerProfile, ThinkerSuggestion


class ThinkerAPIError(Exception):
    """Exception raised when the thinker API fails."""

    def __init__(self, message: str, is_quota_error: bool = False):
        self.message = message
        self.is_quota_error = is_quota_error
        super().__init__(message)


if TYPE_CHECKING:
    from app.models import ConversationThinker, Message

# Cost per token (approximate for Claude Sonnet 4)
INPUT_COST_PER_TOKEN = 0.000003  # $3 per million input tokens
OUTPUT_COST_PER_TOKEN = 0.000015  # $15 per million output tokens
# Extended thinking uses same rate as output tokens
THINKING_COST_PER_TOKEN = 0.000015  # $15 per million thinking tokens


class ThinkerService:
    """Service for thinker suggestions, validation, and conversation simulation."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: AsyncAnthropic | None = None
        self._active_tasks: dict[str, dict[str, asyncio.Task[None]]] = {}
        self._paused_conversations: set[str] = set()

    @property
    def client(self) -> AsyncAnthropic | None:
        """Get the Anthropic client, creating it if needed."""
        if self._client is None and self.settings.anthropic_api_key:
            self._client = AsyncAnthropic(api_key=self.settings.anthropic_api_key)
        return self._client

    async def get_wikipedia_image(self, name: str) -> str | None:
        """Fetch the Wikipedia image URL for a person.

        Uses the Wikipedia API to get the main image from the person's page.
        Returns None if no image found.
        """
        try:
            # Wikipedia requires a User-Agent header
            headers = {
                "User-Agent": "ThinkersChatApp/1.0 (https://github.com/example/thinkers-chat; contact@example.com)"
            }
            async with httpx.AsyncClient(headers=headers) as client:
                # First, search for the Wikipedia page title
                search_url = "https://en.wikipedia.org/w/api.php"
                search_params: dict[str, str | int] = {
                    "action": "query",
                    "list": "search",
                    "srsearch": name,
                    "format": "json",
                    "srlimit": 1,
                }
                response = await client.get(search_url, params=search_params, timeout=5.0)
                data = response.json()

                if not data.get("query", {}).get("search"):
                    return None

                page_title = data["query"]["search"][0]["title"]

                # Get the page images
                image_params: dict[str, str | int] = {
                    "action": "query",
                    "titles": page_title,
                    "prop": "pageimages",
                    "format": "json",
                    "pithumbsize": 200,  # Request 200px thumbnail
                }
                response = await client.get(search_url, params=image_params, timeout=5.0)
                data = response.json()

                pages = data.get("query", {}).get("pages", {})
                for page in pages.values():
                    if "thumbnail" in page:
                        thumbnail_url: str = page["thumbnail"]["source"]
                        return thumbnail_url

                return None
        except Exception:
            return None

    async def suggest_thinkers(
        self, topic: str, count: int = 3, exclude: list[str] | None = None
    ) -> list[ThinkerSuggestion]:
        """Suggest diverse thinkers for a given topic.

        Uses Claude to suggest thinkers who would have interesting,
        diverse perspectives on the topic. Makes parallel API calls for speed.

        Args:
            topic: The topic to suggest thinkers for
            count: Number of suggestions to return (1-5)
            exclude: List of thinker names to exclude from suggestions
        """
        if not self.client:
            return []

        exclude = exclude or []

        # For counts > 2, make parallel calls for faster response
        if count > 2:
            # Split into parallel tasks asking for 1-2 thinkers each
            tasks = []
            remaining = count
            task_num = 0
            perspectives = [
                "scientific or analytical",
                "philosophical or ethical",
                "artistic or creative",
                "political or social",
                "religious or spiritual",
            ]
            while remaining > 0:
                batch_size = min(2, remaining)
                perspective_hint = perspectives[task_num % len(perspectives)]
                tasks.append(
                    self._suggest_single_batch(topic, batch_size, perspective_hint, exclude)
                )
                remaining -= batch_size
                task_num += 1

            # Run all tasks in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Check for API errors first - if any task hit quota, propagate error
            api_error: ThinkerAPIError | None = None
            for result in results:
                if isinstance(result, ThinkerAPIError):
                    api_error = result
                    break

            # Combine results, filtering out errors
            all_suggestions: list[ThinkerSuggestion] = []
            seen_names: set[str] = set()
            for i, result in enumerate(results):
                if isinstance(result, list):
                    logging.info(f"Task {i} returned {len(result)} suggestions")
                    for suggestion in result:
                        # Deduplicate by name
                        if suggestion.name.lower() not in seen_names:
                            seen_names.add(suggestion.name.lower())
                            all_suggestions.append(suggestion)
                elif isinstance(result, Exception):
                    logging.warning(f"Parallel suggestion task {i} failed: {result}")

            # If we got no suggestions and there was an API error, raise it
            if not all_suggestions and api_error:
                raise api_error

            return all_suggestions[:count]

        # For small counts, single call is fine
        return await self._suggest_single_batch(topic, count, None, exclude)

    async def _suggest_single_batch(
        self,
        topic: str,
        count: int,
        perspective_hint: str | None = None,
        exclude: list[str] | None = None,
    ) -> list[ThinkerSuggestion]:
        """Make a single API call to get thinker suggestions."""
        if not self.client:
            return []

        perspective_text = ""
        if perspective_hint:
            perspective_text = f"\nFocus on thinkers with a {perspective_hint} perspective."

        exclude_text = ""
        if exclude:
            exclude_names = ", ".join(exclude)
            exclude_text = f"\n\nIMPORTANT: Do NOT suggest any of these people (they have already been suggested): {exclude_names}"

        prompt = f"""Suggest {count} historical or contemporary thinkers who would have interesting and diverse perspectives on this topic: "{topic}"{perspective_text}{exclude_text}

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
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}],
            )

            # Parse the response
            import json

            first_block = response.content[0]
            if not isinstance(first_block, TextBlock):
                import logging

                logging.warning(f"Claude returned non-text block: {type(first_block)}")
                return []
            raw_content = first_block.text
            content = raw_content.strip()
            if not content:
                import logging

                logging.warning("Claude returned empty response")
                return []
            # Strip markdown code fences if present
            if content.startswith("```"):
                # Remove opening fence (```json or ```)
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                import logging

                logging.warning(
                    f"Failed to parse JSON: {e}. Raw: {repr(raw_content[:300])} | After strip: {repr(content[:300])}"
                )
                return []

            # Build suggestions with image URLs (fetched in parallel)
            suggestions = []
            image_tasks = [self.get_wikipedia_image(item["name"]) for item in data]
            images = await asyncio.gather(*image_tasks, return_exceptions=True)

            for item, image in zip(data, images, strict=False):
                image_url = image if isinstance(image, str) else None
                profile = ThinkerProfile(
                    **item["profile"],
                    image_url=image_url,
                )
                suggestions.append(
                    ThinkerSuggestion(
                        name=item["name"],
                        reason=item["reason"],
                        profile=profile,
                    )
                )
            return suggestions
        except APIError as e:
            logging.warning(f"Anthropic API error: {e}")
            # Check for quota/billing errors
            error_msg = str(e)
            is_quota = "credit balance" in error_msg.lower() or "billing" in error_msg.lower()
            if is_quota:
                raise ThinkerAPIError(
                    "API credit limit reached. Please check your Anthropic billing.",
                    is_quota_error=True,
                ) from e
            raise ThinkerAPIError(f"AI service error: {error_msg}") from e
        except Exception as e:
            logging.warning(f"Failed to get thinker suggestions: {e}")
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
                # Fetch Wikipedia image for the validated thinker
                profile_data = data["profile"]
                image_url = await self.get_wikipedia_image(profile_data["name"])
                return True, ThinkerProfile(**profile_data, image_url=image_url)
            return False, None
        except APIError as e:
            logging.warning(f"Anthropic API error in validate_thinker: {e}")
            error_msg = str(e)
            is_quota = "credit balance" in error_msg.lower() or "billing" in error_msg.lower()
            if is_quota:
                raise ThinkerAPIError(
                    "API credit limit reached. Please check your Anthropic billing.",
                    is_quota_error=True,
                ) from e
            raise ThinkerAPIError(f"AI service error: {error_msg}") from e
        except Exception as e:
            logging.warning(f"Failed to validate thinker: {e}")
            return False, None

    def _choose_response_style(
        self,
        thinker: "ConversationThinker",
        messages: Sequence["Message"],
    ) -> tuple[str, int]:
        """Choose a response style based on conversation context.

        Returns (style_instruction, max_tokens).
        Styles: 'brief' (quick reaction), 'normal' (substantive), 'extended' (deep exploration)
        """
        # Analyze recent messages to decide style
        recent_messages = messages[-5:] if messages else []

        # Check if this thinker just spoke (might want a follow-up)
        just_spoke = recent_messages and recent_messages[-1].sender_name == thinker.name

        # Check if addressed directly
        was_addressed = any(thinker.name.lower() in m.content.lower() for m in recent_messages[-2:])

        # Random selection weighted by context
        roll = random.random()

        if just_spoke and roll < 0.3:
            # Follow-up thought - brief
            return (
                "Respond with a VERY brief follow-up thought (1 short sentence, like 'Though I should add...' or 'Actually, on reflection...')",
                80,
            )
        elif was_addressed:
            # More likely to give a fuller response when addressed
            if roll < 0.2:
                return ("Give a brief, direct response (1 sentence)", 80)
            elif roll < 0.85:
                return ("Give a substantive response (2-4 sentences)", 300)
            else:
                return (
                    "Give a more extended response exploring the idea deeply (4-6 sentences)",
                    500,
                )
        else:
            # Not addressed - more variety
            if roll < 0.25:
                # Quick reaction
                return (
                    "Give a brief reaction or agreement/disagreement (1 short sentence, like 'I couldn't agree more' or 'That's precisely my concern')",
                    80,
                )
            elif roll < 0.85:
                return ("Give a substantive response (2-4 sentences)", 300)
            else:
                return ("Give a more extended response (4-6 sentences)", 500)

    async def generate_response_with_streaming_thinking(
        self,
        conversation_id: str,
        thinker: "ConversationThinker",
        messages: Sequence["Message"],
        topic: str,
    ) -> tuple[str, float]:
        """Generate a response using streaming extended thinking.

        Streams thinking tokens via WebSocket as they're generated,
        then returns the final response text and cost.
        """
        if not self.client:
            return "", 0.0

        # Choose response style based on context
        style_instruction, max_tokens = self._choose_response_style(thinker, messages)

        # Build conversation context
        def get_sender_label(msg: "Message") -> str:
            sender = msg.sender_type
            is_user = (hasattr(sender, "value") and sender.value == "user") or sender == "user"
            return "User" if is_user else (msg.sender_name or "Unknown")

        conversation_history = "\n".join(
            f"{get_sender_label(m)}: {m.content}"
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
- Don't be preachy or lecture-like
- Show personality through your response style

RESPONSE STYLE: {style_instruction}

Respond with ONLY what {thinker.name} would say, nothing else."""

        try:
            # Use streaming with extended thinking
            response_text = ""
            thinking_text = ""
            input_tokens = 0
            output_tokens = 0

            # Track when we last sent a thinking update (throttle to avoid spam)
            last_thinking_update = 0.0
            thinking_update_interval = 0.3  # Send update every 300ms

            async with self.client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens + 2000,  # Extra for thinking budget
                thinking={
                    "type": "enabled",
                    "budget_tokens": 2000,  # Budget for thinking
                },
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for event in stream:
                    # Handle different event types
                    if event.type == "content_block_start":
                        pass  # Block started
                    elif event.type == "content_block_delta":
                        delta = event.delta
                        if hasattr(delta, "thinking") and delta.thinking:
                            # Accumulate thinking text
                            thinking_text += delta.thinking
                            # Throttle updates to avoid overwhelming WebSocket
                            current_time = asyncio.get_event_loop().time()
                            if current_time - last_thinking_update >= thinking_update_interval:
                                # Extract last sentence or meaningful chunk for display
                                display_thinking = self._extract_thinking_display(thinking_text)
                                if display_thinking:
                                    await manager.send_thinker_thinking(
                                        conversation_id, thinker.name, display_thinking
                                    )
                                last_thinking_update = current_time
                        elif hasattr(delta, "text") and delta.text:
                            # Accumulate response text
                            response_text += delta.text
                    elif (
                        event.type == "message_delta"
                        and hasattr(event, "usage")
                        and event.usage
                    ):
                        # Final usage info
                        output_tokens = event.usage.output_tokens

                # Get final message for input token count
                final_message = await stream.get_final_message()
                input_tokens = final_message.usage.input_tokens
                output_tokens = final_message.usage.output_tokens

                # Calculate cost (thinking tokens counted as output)
                # Count thinking tokens from the thinking block
                thinking_tokens = 0
                for block in final_message.content:
                    if isinstance(block, ThinkingBlock):
                        # Approximate thinking tokens from text length
                        thinking_tokens = len(block.thinking) // 4  # Rough estimate

                cost = (
                    input_tokens * INPUT_COST_PER_TOKEN
                    + output_tokens * OUTPUT_COST_PER_TOKEN
                    + thinking_tokens * THINKING_COST_PER_TOKEN
                )

            return response_text.strip(), cost

        except Exception as e:
            logging.warning(f"Error in streaming thinking response: {e}")
            return "", 0.0

    def _extract_thinking_display(self, thinking_text: str) -> str:
        """Extract a displayable portion of the thinking text.

        Returns the last complete sentence or a truncated version of recent thinking.
        """
        if not thinking_text:
            return ""

        # Clean up the text
        text = thinking_text.strip()

        # Get the last ~150 characters for display
        if len(text) > 150:
            text = text[-150:]
            # Try to start at a sentence boundary
            for punct in [". ", "! ", "? ", "\n"]:
                idx = text.find(punct)
                if idx != -1 and idx < 50:
                    text = text[idx + len(punct) :]
                    break

        # Clean up any incomplete words at the start
        if text and not text[0].isupper() and " " in text:
            text = text[text.find(" ") + 1 :]

        # Add ellipsis if truncated
        if text and not text.endswith((".", "!", "?", "...")):
            text = text.rstrip() + "..."

        return text

    async def generate_response(
        self,
        thinker: "ConversationThinker",
        messages: Sequence["Message"],
        topic: str,
    ) -> tuple[str, float]:
        """Generate a response from a thinker (non-streaming fallback).

        Returns (response_text, cost).
        """
        if not self.client:
            return "", 0.0

        # Choose response style based on context
        style_instruction, max_tokens = self._choose_response_style(thinker, messages)

        # Build conversation context
        def get_sender_label(msg: "Message") -> str:
            sender = msg.sender_type
            is_user = (hasattr(sender, "value") and sender.value == "user") or sender == "user"
            return "User" if is_user else (msg.sender_name or "Unknown")

        conversation_history = "\n".join(
            f"{get_sender_label(m)}: {m.content}"
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
- Don't be preachy or lecture-like
- Show personality through your response style

RESPONSE STYLE: {style_instruction}

Respond with ONLY what {thinker.name} would say, nothing else."""

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
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
        # Clean up paused state
        self._paused_conversations.discard(conversation_id)

    def pause_conversation(self, conversation_id: str) -> None:
        """Pause all thinker agents for a conversation."""
        self._paused_conversations.add(conversation_id)

    def resume_conversation(self, conversation_id: str) -> None:
        """Resume all thinker agents for a conversation."""
        self._paused_conversations.discard(conversation_id)

    def is_paused(self, conversation_id: str) -> bool:
        """Check if a conversation is paused."""
        return conversation_id in self._paused_conversations

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
        Uses variable timing for more natural conversation flow.
        """
        last_response_count = 0
        consecutive_silence = 0  # Track how long since last response

        while True:
            try:
                # Check if conversation is active (users connected)
                if not manager.is_conversation_active(conversation_id):
                    # Wait for users to reconnect
                    await asyncio.sleep(1)
                    continue

                # Check if conversation is paused
                if self.is_paused(conversation_id):
                    # Wait while paused
                    await asyncio.sleep(0.5)
                    continue

                # Get current messages
                messages = await get_messages(conversation_id)

                # Decide whether to respond
                should_respond = self._should_respond(
                    thinker, messages, last_response_count, consecutive_silence
                )

                if should_respond:
                    consecutive_silence = 0

                    # Show typing indicator
                    await manager.send_thinker_typing(conversation_id, thinker.name)

                    # Small initial delay before starting response generation
                    await asyncio.sleep(random.uniform(0.5, 1.5))

                    # Check pause state before generating (prevents spend during pause)
                    if self.is_paused(conversation_id):
                        await manager.send_thinker_stopped_typing(conversation_id, thinker.name)
                        continue

                    # Generate response with streaming thinking
                    # This streams thinking tokens via WebSocket as they're generated
                    response_text, cost = await self.generate_response_with_streaming_thinking(
                        conversation_id, thinker, messages, topic
                    )

                    # Check pause state again before saving (in case paused during generation)
                    if self.is_paused(conversation_id):
                        await manager.send_thinker_stopped_typing(conversation_id, thinker.name)
                        continue

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

                        # Chance to send a follow-up thought (consecutive message)
                        if random.random() < 0.15:  # 15% chance of follow-up
                            await asyncio.sleep(random.uniform(2.0, 5.0))
                            if not self.is_paused(conversation_id):
                                # Get updated messages including our first response
                                updated_messages = await get_messages(conversation_id)
                                followup_text, followup_cost = await self.generate_response(
                                    thinker, updated_messages, topic
                                )
                                if followup_text:
                                    followup_msg = await save_message(
                                        conversation_id,
                                        thinker.name,
                                        followup_text,
                                        followup_cost,
                                    )
                                    await manager.send_thinker_message(
                                        conversation_id,
                                        thinker.name,
                                        followup_text,
                                        followup_msg.id,
                                        followup_cost,
                                    )
                                    last_response_count = len(updated_messages) + 1
                    else:
                        await manager.send_thinker_stopped_typing(conversation_id, thinker.name)
                else:
                    consecutive_silence += 1

                # Variable wait before checking again
                # Shorter waits when conversation is active, longer when quiet
                if consecutive_silence > 3:
                    wait_time = random.uniform(5.0, 12.0)  # Quiet conversation
                else:
                    wait_time = random.uniform(2.0, 6.0)  # Active conversation
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
        consecutive_silence: int = 0,
    ) -> bool:
        """Decide if a thinker should respond to the current conversation state.

        Uses heuristics to create natural conversation flow:
        - Respond after new messages arrive
        - Don't respond too frequently
        - Higher chance to respond when addressed or when topic is relevant
        - May stay silent for multiple turns (more realistic)
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
        base_probability = min(0.25 + (new_message_count * 0.12), 0.7)

        # Higher probability if addressed
        if was_addressed:
            base_probability = min(base_probability + 0.5, 0.95)

        # Increase probability if been silent for a while (should eventually respond)
        if consecutive_silence > 2:
            base_probability = min(base_probability + (consecutive_silence * 0.1), 0.9)

        # Don't respond to your own message immediately (but allow follow-ups handled elsewhere)
        if messages and messages[-1].sender_name == thinker.name:
            base_probability = 0.05  # Very low - follow-ups handled separately

        # Sometimes stay completely silent for variety (unless addressed)
        if not was_addressed and random.random() < 0.15:
            return False

        return random.random() < base_probability


# Global service instance
thinker_service = ThinkerService()
