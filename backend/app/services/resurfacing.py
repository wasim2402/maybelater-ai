"""The resurfacing engine: which saved items are worth another look *now*, and why.

Resurfacing shows items inside the app; it never sends a notification (that is reminders, stage 11).

`evaluate()` is a pure function of (items, preferences, time zone, now): no database, no clock, no
randomness, so the same inputs always give the same answer and every rule is unit-testable.

Signals, strongest first (also the ranking order):
  1. date      - a date the user chose ("bring it back on ...") has arrived;
  2. snooze    - a snooze the user set has ended;
  3. condition - a condition the user confirmed (kept or wrote) matches now in their time zone,
                 e.g. "this weekend", "this evening". AI-suggested conditions never count until the
                 user accepts them;
  4. stale     - not looked at for N days (only if the user turned it on; off by default).

Always excluded: completed/archived items, items still snoozed, and items dismissed ("not now")
within the suppression window, unless the user chose a new date after dismissing.
`condition` and `stale` also respect the user's frequency (a cooldown between appearances) and the
"suggest items" switch; dates and snoozes are the user's own instructions and always apply.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from app.core.time import ensure_utc
from app.schemas.user import UserPreferences

Signal = Literal["date", "snooze", "condition", "stale"]
NextAction = Literal["open", "snooze", "complete"]

SIGNAL_RANK: dict[Signal, int] = {"date": 0, "snooze": 1, "condition": 2, "stale": 3}
DISMISS_SUPPRESSION = timedelta(days=30)
FREQUENCY_COOLDOWN = {"daily": timedelta(days=1), "few_times_week": timedelta(days=2), "weekly": timedelta(days=7)}
MAX_RESULTS = 20
USER_DECIDED = {"accepted", "edited"}


@dataclass(frozen=True)
class ItemSnapshot:
    """What the engine needs to know about one item. All datetimes are timezone-aware."""

    id: uuid.UUID
    status: str
    created_at: datetime
    resurface_at: datetime | None = None
    snoozed_until: datetime | None = None
    dismissed_at: datetime | None = None
    last_viewed_at: datetime | None = None
    last_resurfaced_at: datetime | None = None
    resurface_condition: str | None = None
    condition_state: str | None = None  # field_states["resurface_condition"]


@dataclass(frozen=True)
class Candidate:
    id: uuid.UUID
    signal: Signal
    reason: str
    next_action: NextAction
    due_at: datetime  # when it became relevant (for ordering and display)


# --- simple conditions ----------------------------------------------------------------------------
# A small, explicit vocabulary. Anything else is kept as a note for the user but never triggers.

_CONDITIONS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bweekends?\b|\bsaturday\b|\bsunday\b"), "weekend"),
    (re.compile(r"\bweekdays?\b|\bworkday\b"), "weekday"),
    (re.compile(r"\bevenings?\b|\btonight\b|\bafter work\b"), "evening"),
    (re.compile(r"\bmornings?\b"), "morning"),
    (re.compile(r"\blunch(time)?\b|\bmidday\b"), "lunch"),
]


def condition_kind(text: str | None) -> str | None:
    """Maps a condition the user wrote to a rule the engine understands, or None."""
    if not text:
        return None
    lowered = text.lower()
    for pattern, kind in _CONDITIONS:
        if pattern.search(lowered):
            return kind
    return None


def condition_matches(kind: str, local: datetime) -> bool:
    weekday, hour = local.weekday(), local.hour  # Monday = 0
    if kind == "weekend":
        return weekday >= 5
    if kind == "weekday":
        return weekday < 5
    if kind == "evening":
        return 18 <= hour < 23
    if kind == "morning":
        return 6 <= hour < 12
    if kind == "lunch":
        return 11 <= hour < 14
    return False


_KIND_LABEL = {"weekend": "it's the weekend", "weekday": "it's a weekday", "evening": "it's evening", "morning": "it's morning", "lunch": "it's lunchtime"}


# --- the engine -----------------------------------------------------------------------------------


def _local_day(moment: datetime, tz: ZoneInfo) -> date:
    return moment.astimezone(tz).date()


def _fmt_day(moment: datetime, tz: ZoneInfo, now: datetime) -> str:
    local, today = moment.astimezone(tz), now.astimezone(tz).date()
    if local.date() == today:
        return "today"
    if local.date() == today - timedelta(days=1):
        return "yesterday"
    return local.strftime("%a %d %b").replace(" 0", " ")


def _dismissed_recently(item: ItemSnapshot, now: datetime) -> bool:
    return item.dismissed_at is not None and now - item.dismissed_at < DISMISS_SUPPRESSION


def _cooled_down(item: ItemSnapshot, now: datetime, tz: ZoneInfo, cooldown: timedelta) -> bool:
    """Shown again only after the cooldown; seeing it again on the same local day is fine."""
    last = item.last_resurfaced_at
    return last is None or _local_day(last, tz) == _local_day(now, tz) or now - last >= cooldown


def evaluate(items: list[ItemSnapshot], prefs: UserPreferences, timezone: str, now: datetime) -> list[Candidate]:
    now = ensure_utc(now)
    tz = ZoneInfo(timezone)
    local_now = now.astimezone(tz)
    cooldown = FREQUENCY_COOLDOWN[prefs.resurfacing.frequency]
    suggestions_on = prefs.resurfacing.enabled
    stale_after = timedelta(days=prefs.resurfacing.stale_after_days) if prefs.resurfacing.stale_after_days else None

    found: list[Candidate] = []
    for item in items:
        if item.status not in ("inbox", "active"):
            continue  # completed and archived never resurface
        if item.snoozed_until is not None and item.snoozed_until > now:
            continue  # still snoozed: never early
        # A date and an ended snooze can both apply; the more recent instruction explains it best.
        own = [c for c in (_date_signal(item, now, tz), _snooze_signal(item, now, tz)) if c]
        candidate = (
            (max(own, key=lambda c: c.due_at) if own else None)
            or (suggestions_on and _condition_signal(item, now, local_now, tz, cooldown))
            or (suggestions_on and stale_after and _stale_signal(item, now, tz, cooldown, stale_after))
            or None
        )
        if candidate:
            found.append(candidate)

    found.sort(key=lambda c: (SIGNAL_RANK[c.signal], c.due_at, str(c.id)))
    return found[:MAX_RESULTS]


def _date_signal(item: ItemSnapshot, now: datetime, tz: ZoneInfo) -> Candidate | None:
    due = item.resurface_at
    if due is None or due > now:
        return None
    if item.last_viewed_at is not None and item.last_viewed_at >= due:
        return None  # already opened since it came due
    if item.dismissed_at is not None and item.dismissed_at >= due:
        return None  # "not now" after it came due
    return Candidate(item.id, "date", f"You asked to see this again {_fmt_day(due, tz, now)}.", "open", due)


def _snooze_signal(item: ItemSnapshot, now: datetime, tz: ZoneInfo) -> Candidate | None:
    ended = item.snoozed_until
    if ended is None or ended > now:
        return None
    if item.last_viewed_at is not None and item.last_viewed_at >= ended:
        return None
    if item.dismissed_at is not None and item.dismissed_at >= ended:
        return None
    return Candidate(item.id, "snooze", f"Your snooze ended {_fmt_day(ended, tz, now)}.", "open", ended)


def _condition_signal(
    item: ItemSnapshot, now: datetime, local_now: datetime, tz: ZoneInfo, cooldown: timedelta
) -> Candidate | None:
    if item.condition_state not in USER_DECIDED:
        return None  # an AI suggestion the user has not confirmed never triggers resurfacing
    kind = condition_kind(item.resurface_condition)
    if kind is None or not condition_matches(kind, local_now):
        return None
    if _dismissed_recently(item, now) or not _cooled_down(item, now, tz, cooldown):
        return None
    start_of_today = datetime.combine(local_now.date(), time.min, tzinfo=tz)
    return Candidate(item.id, "condition", f"You saved this for “{item.resurface_condition}”, and {_KIND_LABEL[kind]}.", "open", start_of_today)


def _stale_signal(item: ItemSnapshot, now: datetime, tz: ZoneInfo, cooldown: timedelta, stale_after: timedelta) -> Candidate | None:
    last_touch = max(filter(None, [item.created_at, item.last_viewed_at]))
    if now - last_touch < stale_after:
        return None
    if _dismissed_recently(item, now) or not _cooled_down(item, now, tz, cooldown):
        return None
    days = (now - last_touch).days
    return Candidate(item.id, "stale", f"You haven't looked at this in {days} days.", "open", last_touch + stale_after)


# --- "when" presets for snooze and "bring it back" ------------------------------------------------

Preset = Literal["tomorrow", "weekend", "next_week", "in_a_month"]


def resolve_preset(preset: Preset, timezone: str, now: datetime) -> datetime:
    """A wall-clock time in the user's zone, returned in UTC. Daylight-saving changes are handled by
    zoneinfo: "9 am tomorrow" is 9 am local even when the UTC offset changes overnight."""
    tz = ZoneInfo(timezone)
    local = ensure_utc(now).astimezone(tz)
    if preset == "tomorrow":
        day, at = local.date() + timedelta(days=1), time(9, 0)
    elif preset == "weekend":
        days_to_saturday = (5 - local.weekday()) % 7
        day = local.date() + timedelta(days=days_to_saturday)
        at = time(10, 0)
        if datetime.combine(day, at, tzinfo=tz) <= local:  # it's already Saturday 10:00 or later
            day += timedelta(days=7)
    elif preset == "next_week":
        day, at = local.date() + timedelta(days=(7 - local.weekday()) or 7), time(9, 0)
    else:  # in_a_month
        day, at = local.date() + timedelta(days=30), time(9, 0)
    return datetime.combine(day, at, tzinfo=tz).astimezone(ZoneInfo("UTC"))
