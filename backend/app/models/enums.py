"""Allowed values for status-like columns. The database enforces the same lists with CHECK constraints."""

from enum import StrEnum


class SourceType(StrEnum):
    TEXT = "text"
    URL = "url"
    IMAGE = "image"  # later
    VOICE = "voice"  # later


class IntentionStatus(StrEnum):
    INBOX = "inbox"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class AnalysisStatus(StrEnum):
    """State of AI analysis on an intention. `off` = the user turned suggestions off for it."""

    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"
    OFF = "off"


class AnalysisRunStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class FieldState(StrEnum):
    """Who stands behind an editable field's current value. AI may only write a field whose state is
    absent or `suggested`; `accepted`, `edited` and `dismissed` belong to the user."""

    SUGGESTED = "suggested"
    ACCEPTED = "accepted"
    EDITED = "edited"
    DISMISSED = "dismissed"


EDITABLE_FIELDS = ("title", "summary", "intent", "category", "tags", "resurface_condition")


class ReminderStatus(StrEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENT = "sent"
    SNOOZED = "snoozed"
    CANCELLED = "cancelled"


class DeliveryChannel(StrEnum):
    IN_APP = "in_app"
    EMAIL = "email"  # later, after consent and unsubscribe exist
    WEB_PUSH = "web_push"  # later


class DeliveryStatus(StrEnum):
    PENDING = "pending"  # attempted, waiting for a retry
    DELIVERED = "delivered"
    FAILED = "failed"  # gave up after the last attempt, or a permanent error


class ActivityType(StrEnum):
    CAPTURED = "captured"
    ANALYSIS_COMPLETED = "analysis_completed"
    ANALYSIS_FAILED = "analysis_failed"
    EDITED = "edited"
    REMINDER_CREATED = "reminder_created"
    REMINDER_SENT = "reminder_sent"
    RESURFACED = "resurfaced"
    SNOOZED = "snoozed"
    DISMISSED = "dismissed"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    RESTORED = "restored"


def values(enum: type[StrEnum]) -> tuple[str, ...]:
    return tuple(member.value for member in enum)
