"""Shared FastAPI dependencies. Auth (current user) joins these in stage 05."""

from fastapi import Request

from app.core.config import Settings, get_settings


def app_settings(request: Request) -> Settings:
    """The settings the running app was created with (tests pass their own to create_app)."""
    return getattr(request.app.state, "settings", None) or get_settings()
