"""Shared FastAPI dependencies: settings, database session and the current user."""

from collections.abc import AsyncIterator

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import TokenVerifier, bearer_token
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import User
from app.services.users import get_or_create_user


def app_settings(request: Request) -> Settings:
    """The settings the running app was created with (tests pass their own to create_app)."""
    return getattr(request.app.state, "settings", None) or get_settings()


def token_verifier(request: Request) -> TokenVerifier:
    verifier = getattr(request.app.state, "token_verifier", None)
    if verifier is None:
        verifier = TokenVerifier.from_settings(app_settings(request))
        request.app.state.token_verifier = verifier
    return verifier


async def db_session() -> AsyncIterator[AsyncSession]:
    async for session in get_db():
        yield session


async def current_user(
    request: Request,
    authorization: str | None = Header(default=None, include_in_schema=False),
    verifier: TokenVerifier = Depends(token_verifier),
    session: AsyncSession = Depends(db_session),
) -> User:
    """The authenticated user, from the verified bearer token. Every protected route depends on this,
    and every user-owned query filters by the returned user's id."""
    verified = await verifier.verify(bearer_token(authorization))
    user = await get_or_create_user(session, verified)
    request.state.user_id = str(user.id)  # rate limits key on the user from here on
    return user
