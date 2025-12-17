# Thinkers Chat

Real-time multi-party chat with AI-simulated historical and contemporary thinkers.

## Quick Start (Local Development)

### Prerequisites

- [uv](https://docs.astral.sh/uv/) - Python package manager
- [Node.js](https://nodejs.org/) v18+
- [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
# Clone the repo
git clone https://github.com/jeremymatthewwerner/thinkers-chat.git
cd thinkers-chat

# Run setup script
./scripts/setup.sh

# Add your Anthropic API key
echo "ANTHROPIC_API_KEY=your-key-here" >> backend/.env
```

### Run

```bash
./scripts/dev.sh
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Test

```bash
./scripts/test-all.sh
```

## Deploy to Railway

### Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) - `npm install -g @railway/cli`
- Railway account at https://railway.app

### Deployment

```bash
./scripts/deploy-railway.sh
```

This interactive script will guide you through:
1. Creating a new Railway project
2. Setting up PostgreSQL
3. Deploying backend and frontend services

### Manual Setup

If you prefer manual setup:

1. **Create Railway Project**
   - Go to https://railway.app/new
   - Click "Empty Project"

2. **Add PostgreSQL**
   - Click "+ New" → "Database" → "Add PostgreSQL"

3. **Add Backend Service**
   - Click "+ New" → "GitHub Repo" → Select this repo
   - In Settings, set:
     - Root Directory: `/` (repo root)
     - Build: Dockerfile
     - Dockerfile Path: `backend/Dockerfile`
   - Add environment variables:
     - `ANTHROPIC_API_KEY` = your API key
     - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
     - `CORS_ORIGINS` = `https://<your-frontend>.up.railway.app`

4. **Add Frontend Service**
   - Click "+ New" → "GitHub Repo" → Select this repo
   - In Settings, set:
     - Root Directory: `/` (repo root)
     - Build: Dockerfile
     - Dockerfile Path: `frontend/Dockerfile`
   - Add environment variables:
     - `NEXT_PUBLIC_API_URL` = `https://<your-backend>.up.railway.app`
     - `NEXT_PUBLIC_WS_URL` = `wss://<your-backend>.up.railway.app`

## CI/CD with GitHub Actions

The project includes a CI/CD pipeline that runs tests and deploys to Railway on push to `main`.

### GitHub Secrets Required

Add these secrets in your GitHub repository settings (**Settings** → **Secrets and variables** → **Actions** → **New repository secret**):

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for E2E tests | https://console.anthropic.com/ |
| `RAILWAY_TOKEN` | Railway API token for deployments | Railway dashboard → Account Settings → Tokens → Create Token |
| `PRODUCTION_BACKEND_URL` | Backend URL for smoke tests | Your Railway backend URL (e.g., `https://backend-xxx.up.railway.app`) |
| `PRODUCTION_FRONTEND_URL` | Frontend URL for smoke tests | Your Railway frontend URL (e.g., `https://frontend-xxx.up.railway.app`) |

### Pipeline Steps

1. **Backend Tests** - Lint, type check, and test with coverage
2. **Frontend Tests** - Lint, type check, and test with coverage
3. **E2E Tests** - Run Playwright tests against real backend
4. **Docker Build** - Verify Docker images build correctly
5. **Deploy** - Deploy to Railway (only on push to `main`)
6. **Smoke Test** - Verify production endpoints are healthy

## Project Structure

```
thinkers-chat/
├── .github/
│   └── workflows/
│       └── ci.yml     # CI/CD pipeline
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # API routes
│   │   ├── core/      # Config, database
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic
│   ├── tests/
│   ├── Dockerfile
│   └── railway.json   # Railway config
├── frontend/          # Next.js frontend
│   ├── src/
│   ├── e2e/           # Playwright tests
│   ├── Dockerfile
│   └── railway.json   # Railway config
└── scripts/
    ├── setup.sh       # Local dev setup
    ├── dev.sh         # Run dev servers
    ├── test-all.sh    # Run all tests
    └── railway-setup.sh  # Railway CLI setup helper
```

## Tech Stack

- **Frontend**: Next.js, TypeScript, TailwindCSS
- **Backend**: FastAPI, SQLAlchemy, Python 3.11
- **Database**: SQLite (local), PostgreSQL (production)
- **AI**: Claude API (Anthropic)
- **Real-time**: WebSockets
- **Deployment**: Railway

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | (required) |
| `DATABASE_URL` | Database connection URL | `sqlite+aiosqlite:///./thinkers_chat.db` |
| `DEBUG` | Enable debug mode | `true` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:8000` |
