from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, Index, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey

if TYPE_CHECKING:
    from app.models.intention import Intention


class User(UUIDPrimaryKey, Timestamps, Base):
    """The app's view of a person. Authentication itself (passwords, sessions) belongs to Better Auth
    (stage 05); `auth_subject` is the verified subject id from its token and the only link to it."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(auth_subject) BETWEEN 1 AND 255", name="auth_subject_length"),
        CheckConstraint("length(timezone) BETWEEN 1 AND 64", name="timezone_length"),
        CheckConstraint("jsonb_typeof(preferences) = 'object'", name="preferences_is_object"),
        # One account per email when an email is known; case-insensitive.
        Index("uq_users_email_lower", func.lower(text("email")), unique=True, postgresql_where=text("email IS NOT NULL")),
    )

    auth_subject: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(320))
    display_name: Mapped[str | None] = mapped_column(String(120))
    # IANA zone, e.g. "Asia/Kolkata". Used for scheduling and display; storage stays UTC.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, server_default="UTC")
    # Reminder, resurfacing and accessibility preferences; shape validated by schemas.user.UserPreferences.
    preferences: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict)

    intentions: Mapped[list[Intention]] = relationship(back_populates="user", passive_deletes=True)
