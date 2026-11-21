"""Web Push devices: whether push is available, subscribe this browser, unsubscribe, send a test."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.deps import current_user, db_session
from app.core.errors import NotFoundError
from app.core.rate_limit import RateLimit
from app.models import PushSubscription, User
from app.services import push as service

router = APIRouter(prefix="/notifications/push", tags=["notifications"])


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def push_sender(request: Request) -> service.PushSender:
    """The sender (tests replace it via app.state.push_sender)."""
    override = getattr(request.app.state, "push_sender", None)
    if override is not None:
        return override
    return service.WebPushSender(_settings(request))  # 503 push_not_configured without VAPID keys


class Keys(BaseModel):
    model_config = ConfigDict(extra="ignore")

    p256dh: str = Field(min_length=20, max_length=255)
    auth: str = Field(min_length=10, max_length=64)


class SubscriptionIn(BaseModel):
    """The browser's PushSubscription.toJSON(), plus an optional device label."""

    model_config = ConfigDict(extra="ignore")

    endpoint: str = Field(min_length=10, max_length=1024)
    keys: Keys
    label: str | None = Field(default=None, max_length=120)


class EndpointIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1024)


class DeviceOut(BaseModel):
    id: UUID
    label: str | None
    created_at: datetime
    last_success_at: datetime | None


class PushStatus(BaseModel):
    available: bool = Field(description="False until the server has VAPID keys")
    public_key: str | None = Field(description="applicationServerKey for PushManager.subscribe")
    devices: list[DeviceOut]


class TestResult(BaseModel):
    sent: int


def _device(sub: PushSubscription) -> DeviceOut:
    return DeviceOut(id=sub.id, label=sub.label, created_at=sub.created_at, last_success_at=sub.last_success_at)


@router.get("", response_model=PushStatus)
async def push_status(
    request: Request, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)
) -> PushStatus:
    settings = _settings(request)
    available = settings.push_configured or getattr(request.app.state, "push_sender", None) is not None
    devices = await service.active_subscriptions(session, user.id)
    return PushStatus(
        available=available,
        public_key=settings.vapid_public_key or None,
        devices=[_device(d) for d in sorted(devices, key=lambda d: d.created_at)],
    )


@router.post("/subscriptions", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def subscribe(
    body: SubscriptionIn, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)
) -> DeviceOut:
    """Saves this browser's subscription (after the user turned notifications on and allowed them)."""
    sub = await service.subscribe(session, user, body.endpoint, body.keys.p256dh, body.keys.auth, body.label)
    return _device(sub)


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(body: EndpointIn, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> Response:
    """This browser stops receiving notifications. Idempotent."""
    await service.unsubscribe(session, user, body.endpoint)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_device(
    subscription_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)
) -> Response:
    """Removes one of the user's devices from the list (for a browser they no longer use)."""
    sub = (
        await session.execute(select(PushSubscription).where(PushSubscription.id == subscription_id, PushSubscription.user_id == user.id))
    ).scalar_one_or_none()
    if sub is None:
        raise NotFoundError("We could not find that device.")
    await session.delete(sub)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test", response_model=TestResult, dependencies=[Depends(RateLimit("push-test", limit=5, window_seconds=60))])
async def send_test(
    user: User = Depends(current_user), session: AsyncSession = Depends(db_session), sender: service.PushSender = Depends(push_sender)
) -> TestResult:
    """Sends a test notification to each of the user's devices."""
    return TestResult(sent=await service.send_test(session, user, sender))
