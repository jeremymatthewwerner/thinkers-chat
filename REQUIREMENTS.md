# Requirements Specification: Thinkers Chat

## 1. Product Vision

Create an engaging, educational chat experience where users can have real-time group discussions with AI simulations of history's greatest thinkers. The experience should feel authentic - as if you've gathered Socrates, Einstein, and Maya Angelou in a group chat to discuss consciousness, creativity, or any topic of interest.

## 2. Core Features

### 2.1 User Interface Structure
- Sidebar showing list of previous chats (similar to ChatGPT interface)
- Each chat shows preview/title in sidebar
- Affordance to start a new chat prominently displayed
- Clean, familiar chat interface pattern
- **Cost meter**: Display running total of LLM costs incurred since page load

### 2.2 New Chat Creation Flow
1. User clicks "New Chat"
2. User specifies number of thinkers to include
3. User writes 1-2 sentences describing the topic/question for discussion
4. System suggests appropriate thinkers based on the topic
5. User can:
   - Accept suggested thinkers
   - Ask to swap any thinker for another suggestion
   - Override by typing a specific thinker's name (system confirms they're a real person)
6. Chat begins once thinker selection is confirmed

### 2.3 Thinker Selection & Suggestion
- System uses LLM to suggest thinkers based on the topic
- Suggestion criteria:
  - Diverse viewpoints (people who might disagree with each other)
  - Some relevance to topic preferred but not strictly required
  - Mix of eras/backgrounds when appropriate
- When user types a custom thinker name:
  - System uses LLM + web search to verify person is real
  - System retrieves biographical info to build thinker profile
- Thinker profiles (generated dynamically or cached) include:
  - Biographical summary
  - Known positions and beliefs
  - Communication style characteristics
  - Historical context/era
- Living and historical figures both allowed

### 2.4 Thinker Behavior & Personality
- **Language**: All thinkers communicate in modern English regardless of era
- **Novel topics**: When addressing topics that didn't exist in their time, thinkers:
  - Apply their known philosophical/intellectual frameworks
  - Explicitly acknowledge the anachronism (e.g., "In my era we didn't have computers, but...")
- **Authenticity vs. creativity**:
  - LLM should reason about how the person would likely respond
  - Can be speculative/generative for engaging conversation
  - Not strictly limited to documented historical positions
- **Interaction style**:
  - Thinkers engage with each other, not just the user
  - They may agree, disagree, build on ideas, or challenge each other
  - Personality should feel consistent throughout conversation

### 2.5 Real-Time Chat Experience
- Messages appear in real-time as thinkers "type"
- Multiple thinkers can compose/send messages concurrently
- Typing indicators show when thinkers are composing
- Natural conversation flow:
  - Thinkers respond to each other, not just the user
  - Agreements, disagreements, and building on ideas
  - Occasional tangents and diversions (as real conversations have)
  - Variable response times (some thinkers more verbose, some more terse)
- **Active window model**:
  - Conversation only progresses when user has the chat open/focused
  - When user navigates away, conversation pauses (no background messages)
  - When user returns/visits a chat, thinkers automatically resume typing/responding

### 2.6 User Participation
- User can send messages at any time
- User messages are visible to all thinker agents
- Thinkers respond to and engage with user contributions
- User can steer the conversation with questions or topic shifts

### 2.7 Conversation Management
- Ability to pause/resume conversations
- Save conversation history
- Export conversations (text, markdown, etc.)
- Start new topic in same room or create new room

## 3. Non-Functional Requirements

### 3.1 Performance
- Low latency message delivery (<500ms)
- Support concurrent agent responses without blocking
- Graceful handling of LLM API rate limits

### 3.2 User Experience
- Clean, intuitive chat interface
- Mobile-responsive design
- Accessible (screen reader compatible, keyboard navigation)
- Clear visual distinction between different thinkers

### 3.3 Safety & Ethics
- Clear disclaimer that these are AI simulations, not actual people
- Content moderation for user inputs
- Responsible handling of controversial topics/figures
- Avoid putting harmful statements in historical figures' mouths

### 3.4 Scalability
- Support multiple concurrent users/chat rooms
- Efficient LLM token usage
- Consider caching for common responses/patterns

## 4. Technical Requirements

### 4.1 Agent Architecture
- Each thinker implemented as independent agent
- Agents maintain conversation context
- Agents have access to their thinker profile/persona
- Agents can "see" all messages and decide when/how to respond

### 4.2 Concurrency Model
- Parallel agent execution for realistic multi-party feel
- Coordination mechanism to prevent response flooding
- Natural timing/pacing algorithms

### 4.3 LLM Integration
- Robust prompt engineering for persona consistency
- Context window management for long conversations
- Fallback handling for API failures

## 5. Future Considerations (Out of Initial Scope)

- User authentication (email/OAuth) - MVP uses local storage/anonymous sessions
- Custom thinker creation
- Voice synthesis for thinker responses
- Debate mode with structured formats
- Educational integrations (classroom use)
- Mobile apps

## 6. Open Questions

- [x] What tech stack best supports the real-time, concurrent agent requirement?
  - **Decided**: Next.js frontend, FastAPI backend, PostgreSQL, WebSockets
- [x] How do we handle thinkers from different eras/languages authentically?
  - **Decided**: All thinkers communicate in modern English for accessibility
- [x] What's the right balance of historical accuracy vs. engaging conversation?
  - **Decided**: Thinkers can be speculative/creative for engagement. LLM should reason about how the person might respond but can be generative rather than strictly historical.
- [x] How do we handle topics the historical figure never addressed?
  - **Decided**: Apply known frameworks to new concepts, with explicit acknowledgment (e.g., "In my time we didn't have X, but applying my views on Y...")
- [x] Pricing/usage model for LLM costs?
  - **Decided**: Monitor and see. Display a cost meter in the UI showing cost incurred since page load.
