"""The validated shape of `users.preferences` (JSONB). Missing keys take these defaults, so new
preferences can be added without a migration."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.time import zone


class QuietHours(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: str = Field(default="22:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(default="07:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class ReminderPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    quiet_hours: QuietHours | None = None


class ResurfacingPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    frequency: Literal["daily", "few_times_week", "weekly"] = "few_times_week"
    # Bring back items not reviewed for this many days. Off (None) by default, per stage 10.
    stale_after_days: int | None = Field(default=None, ge=7, le=365)


class UserPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reminders: ReminderPreferences = ReminderPreferences()
    resurfacing: ResurfacingPreferences = ResurfacingPreferences()
    reduce_motion: bool = False


def validate_timezone(value: str) -> str:
    """For request schemas that accept an IANA zone (settings, reminders)."""
    zone(value)  # raises ValueError for unknown zones
    return value

