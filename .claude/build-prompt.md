# Build Prompt: Thinkers Chat Application

## Context

You are continuing work on the Thinkers Chat project. Read CLAUDE.md and REQUIREMENTS.md for full context.

## What's Already Built

### Backend (`/backend`)
- FastAPI app with health endpoint (`app/main.py`)
- pytest + pytest-asyncio + pytest-cov configured
- ruff + mypy (strict) configured
- uv for dependency management
- Basic test in `tests/test_main.py`

### Frontend (`/frontend`)
- Next.js 16 with TypeScript strict mode
- Jest + React Testing Library configured
- Playwright for E2E configured
- ESLint + Prettier configured
- Tailwind CSS
- Basic test in `src/__tests__/page.test.tsx`

### CI/CD
- GitHub Actions workflow in `.github/workflows/ci.yml`
- 80% coverage requirement

## What Needs to Be Built

Build a working local demo of Thinkers Chat with these features:

### 1. Database (PostgreSQL + SQLAlchemy)
Create models in `backend/app/models/`:
- **Session**: Anonymous user sessions (id, created_at)
- **Conversation**: Chat conversations (id, session_id, topic, created_at)
- **ConversationThinker**: Thinkers in a conversation (id, conversation_id, name, bio, positions, style)
- **Message**: Chat messages (id, conversation_id, sender_type, sender_name, content, created_at)

Set up:
- SQLAlchemy async with asyncpg
- Alembic for migrations
- Database config in `backend/app/core/config.py`

### 2. API Endpoints (`backend/app/api/`)
- `POST /api/conversations` - Create new conversation with topic and thinker count
- `GET /api/conversations` - List conversations for session
- `GET /api/conversations/{id}` - Get conversation with messages
- `POST /api/conversations/{id}/messages` - User sends a message
- `POST /api/thinkers/suggest` - Get thinker suggestions for a topic (uses Claude API)
- `POST /api/thinkers/validate` - Validate a custom thinker name is real (uses Claude API)

### 3. WebSocket (`backend/app/api/websocket.py`)
- Connect to conversation: `ws://localhost:8000/ws/{conversation_id}`
- Receive real-time messages from thinkers
- Typing indicators
- Pause when client disconnects, resume when reconnects

### 4. Thinker Service (`backend/app/services/thinker.py`)
- Use Claude API (anthropic package) to:
  - Suggest diverse thinkers for a topic
  - Validate custom thinker names
  - Generate thinker profiles (bio, positions, style)
  - Simulate thinker responses in conversation
- Each thinker runs as independent async task
- Thinkers respond to each other, not just user
- Natural timing/pacing

### 5. Frontend UI (`frontend/src/`)

#### Layout
- Sidebar with conversation list (like ChatGPT)
- Main chat area
- Cost meter showing LLM costs since page load

#### Components
- `Sidebar` - List of conversations, "New Chat" button
- `ConversationList` - Shows previous chats
- `ChatArea` - Main chat view with messages
- `MessageList` - Scrollable message list
- `Message` - Individual message (different styles per thinker)
- `MessageInput` - User input field
- `TypingIndicator` - Shows which thinkers are typing
- `NewChatModal` - Create new conversation flow
- `ThinkerSelector` - Select/swap thinkers
- `CostMeter` - Display running LLM cost

#### State Management
- Use React Context or simple useState for MVP
- WebSocket connection management
- Conversation state

### 6. Connect Frontend to Backend
- API client for REST endpoints
- WebSocket client for real-time updates
- Handle reconnection

### 7. Local Development Setup
- Docker Compose for PostgreSQL (or use SQLite for simpler local dev)
- Environment variables (.env.example)
- Scripts to run both frontend and backend

## Key Requirements

1. **Tests**: Write tests alongside code. Minimum 80% coverage.
2. **Type Safety**: Full type hints (Python), strict mode (TypeScript)
3. **Modern English**: All thinkers communicate in modern English
4. **Active Window Model**: Conversation pauses when user leaves, resumes when they return
5. **Cost Tracking**: Track and display Claude API costs

## Environment Variables Needed

```
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/thinkers
ANTHROPIC_API_KEY=your-key-here

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## Run Commands

After building, the user should be able to run:
```bash
# Terminal 1: Database
docker-compose up -d postgres

# Terminal 2: Backend
cd backend && uv run uvicorn app.main:app --reload

# Terminal 3: Frontend
cd frontend && npm run dev
```

Then open http://localhost:3000

## Important Notes

- Use SQLite for MVP to avoid Docker complexity (can switch to Postgres later)
- Mock Claude API responses if no API key is set (for testing)
- Commit and push at logical checkpoints
- Follow existing code patterns in the codebase
