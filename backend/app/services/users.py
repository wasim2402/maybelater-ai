"""The app's user records. Every function takes the user resolved from a verified token."""

from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import VerifiedToken
from app.models import User
from app.schemas.user import UserPreferences


async def get_or_create_user(session: AsyncSession, token: VerifiedToken) -> User:
    """Finds the app user for a verified identity, creating it on first contact. Safe under races:
    two first requests at once both end up with the same row."""
    user = (await session.execute(select(User).where(User.auth_subject == token.subject))).scalar_one_or_none()
    if user is None:
        await session.execute(
            insert(User)
            .values(auth_subject=token.subject, email=token.email, display_name=token.name)
            .on_conflict_do_nothing(index_elements=[User.auth_subject])
        )
        await session.commit()
        user = (await session.execute(select(User).where(User.auth_subject == token.subject))).scalar_one()
    elif token.email and user.email != token.email:
        # The email changed in the auth system: follow it. The display name stays the user's own choice.
        user.email = token.email
        await session.commit()
    return user


def effective_preferences(user: User) -> UserPreferences:
    """Stored preferences merged over defaults (unknown stored keys are dropped, never trusted)."""
    stored = {k: v for k, v in (user.preferences or {}).items() if k in UserPreferences.model_fields}
    return UserPreferences.model_validate(stored)


async def update_user(
    session: AsyncSession,
    user: User,
    *,
    display_name: str | None = None,
    timezone: str | None = None,
    preferences: dict[str, Any] | None = None,
) -> User:
    if display_name is not None:
        user.display_name = display_name.strip() or None
    if timezone is not None:
        user.timezone = timezone
    if preferences is not None:
        user.preferences = UserPreferences.model_validate(preferences).model_dump(mode="json")
    await session.commit()
    await session.refresh(user)
    return user


async def delete_user_data(session: AsyncSession, user: User) -> None:
    """Deletes the user and, by cascade, everything they own (docs/DATA_MODEL.md). The auth account
    itself is deleted by Better Auth in the web app right after."""
    await session.execute(delete(User).where(User.id == user.id))
    await session.commit()
