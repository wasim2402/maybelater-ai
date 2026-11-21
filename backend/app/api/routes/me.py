"""The signed-in user's own account: read, update settings, delete all their data."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import current_user, db_session
from app.core.rate_limit import RateLimit
from app.models import User
from app.schemas.user import UserPreferences, validate_timezone
from app.services.users import delete_user_data, effective_preferences, update_user

router = APIRouter(prefix="/me", tags=["account"])


class MeResponse(BaseModel):
    id: UUID
    email: str | None
    display_name: str | None
    timezone: str
    preferences: UserPreferences
    created_at: datetime


class MeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, max_length=120)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    preferences: UserPreferences | None = None

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value: str | None) -> str | None:
        return None if value is None else validate_timezone(value)


def to_response(user: User) -> MeResponse:
    return MeResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        timezone=user.timezone,
        preferences=effective_preferences(user),
        created_at=user.created_at,
    )


@router.get("", response_model=MeResponse)
async def read_me(user: User = Depends(current_user)) -> MeResponse:
    return to_response(user)


@router.patch("", response_model=MeResponse)
async def update_me(
    body: MeUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> MeResponse:
    prefs: dict[str, Any] | None = body.preferences.model_dump(mode="json") if body.preferences else None
    user = await update_user(session, user, display_name=body.display_name, timezone=body.timezone, preferences=prefs)
    return to_response(user)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RateLimit("delete-account", limit=5, window_seconds=600))],
)
async def delete_me(user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> Response:
    await delete_user_data(session, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
