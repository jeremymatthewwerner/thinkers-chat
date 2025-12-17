"""FastAPI application entrypoint."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api import api_router, ws_router
from app.core.auth import get_password_hash
from app.core.config import get_settings
from app.core.database import async_session, close_db, init_db
from app.models import User

settings = get_settings()
logger = logging.getLogger(__name__)


async def create_admin_user() -> None:
    """Create the default admin user if it doesn't exist."""
    async with async_session() as db:
        # Check if admin user exists
        result = await db.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()

        if not admin:
            # Create admin user with default password
            admin = User(
                username="admin",
                password_hash=get_password_hash("admin"),
                is_admin=True,
            )
            db.add(admin)
            await db.commit()
            logger.info("Created default admin user (username: admin, password: admin)")
        else:
            logger.info("Admin user already exists")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup and shutdown."""
    # Startup: Initialize database
    await init_db()
    # Create admin user
    await create_admin_user()
    yield
    # Shutdown: Close database connections
    await close_db()


app = FastAPI(
    title="Thinkers Chat API",
    description="Real-time multi-party chat with AI-simulated historical/contemporary thinkers",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS configuration - origins from environment variable
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)

# Include WebSocket routes
app.include_router(ws_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}
