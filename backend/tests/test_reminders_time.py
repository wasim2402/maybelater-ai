"""Reminder time rules, pure: wall-clock times across daylight-saving changes, presets, quiet hours."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest

from app.services.reminders import (
    NonexistentLocalTimeError,
    ReminderTimeError,
    in_quiet_hours,
    resolve_local,
    resolve_reminder_preset,
    resolve_time,
)

BERLIN, NEW_YORK = "Europe/Berlin", "America/New_York"


def local(dt: datetime, tz: str) -> str:
    return dt.astimezone(ZoneInfo(tz)).strftime("%Y-%m-%d %H:%M %Z")


def test_local_time_is_resolved_in_the_given_zone() -> None:
    assert resolve_local(datetime(2026, 11, 21, 10, 0), BERLIN) == datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    assert resolve_local(datetime(2026, 11, 21, 10, 0), NEW_YORK) == datetime(2026, 11, 21, 15, 0, tzinfo=UTC)


def test_same_wall_clock_time_either_side_of_a_dst_change_keeps_its_local_hour() -> None:
    # Berlin moves to summer time on 29 March 2026: 09:00 is 08:00 UTC before, 07:00 UTC after.
    assert resolve_local(datetime(2026, 3, 28, 9, 0), BERLIN) == datetime(2026, 3, 28, 8, 0, tzinfo=UTC)
    assert resolve_local(datetime(2026, 3, 29, 9, 0), BERLIN) == datetime(2026, 3, 29, 7, 0, tzinfo=UTC)
    # New York returns to standard time on 1 November 2026.
    assert resolve_local(datetime(2026, 10, 31, 9, 0), NEW_YORK) == datetime(2026, 10, 31, 13, 0, tzinfo=UTC)
    assert resolve_local(datetime(2026, 11, 1, 9, 0), NEW_YORK) == datetime(2026, 11, 1, 14, 0, tzinfo=UTC)


def test_a_time_skipped_by_spring_forward_is_rejected_not_moved() -> None:
    with pytest.raises(NonexistentLocalTimeError):
        resolve_local(datetime(2026, 3, 29, 2, 30), BERLIN)
    with pytest.raises(NonexistentLocalTimeError):
        resolve_local(datetime(2026, 3, 8, 2, 15), NEW_YORK)


def test_a_repeated_time_on_fall_back_takes_the_first_occurrence() -> None:
    # 02:30 happens twice in Berlin on 25 October 2026: first in summer time (00:30 UTC).
    assert resolve_local(datetime(2026, 10, 25, 2, 30), BERLIN) == datetime(2026, 10, 25, 0, 30, tzinfo=UTC)


def test_local_time_must_not_carry_an_offset() -> None:
    with pytest.raises(ValueError):
        resolve_local(datetime(2026, 11, 21, 10, 0, tzinfo=UTC), BERLIN)


def test_tomorrow_morning_across_the_dst_night_is_nine_local() -> None:
    saturday_evening = datetime(2026, 3, 28, 20, 0, tzinfo=UTC)
    when = resolve_reminder_preset("tomorrow", BERLIN, saturday_evening)
    assert local(when, BERLIN) == "2026-03-29 09:00 CEST"


def test_presets_resolve_in_the_users_zone() -> None:
    now = datetime(2026, 11, 18, 11, 0, tzinfo=UTC)  # Wednesday, 12:00 Berlin, 06:00 New York
    assert local(resolve_reminder_preset("this_evening", BERLIN, now), BERLIN) == "2026-11-18 19:00 CET"
    assert local(resolve_reminder_preset("weekend", NEW_YORK, now), NEW_YORK) == "2026-11-21 10:00 EST"
    assert local(resolve_reminder_preset("next_week", BERLIN, now), BERLIN) == "2026-11-23 09:00 CET"
    assert resolve_reminder_preset("in_an_hour", BERLIN, now) == datetime(2026, 11, 18, 12, 0, tzinfo=UTC)


def test_this_evening_after_seven_is_refused() -> None:
    with pytest.raises(ReminderTimeError):
        resolve_reminder_preset("this_evening", BERLIN, datetime(2026, 11, 18, 19, 30, tzinfo=UTC))


@pytest.mark.parametrize(
    "when",
    [datetime(2026, 11, 18, 10, 0, tzinfo=UTC), datetime(2026, 11, 18, 11, 0, tzinfo=UTC), datetime(2027, 12, 1, tzinfo=UTC)],
)
def test_reminder_time_must_be_in_the_future_and_within_a_year(when: datetime) -> None:
    with pytest.raises(ReminderTimeError):
        resolve_time(preset=None, at=when, local=None, timezone=BERLIN, now=datetime(2026, 11, 18, 11, 0, tzinfo=UTC))


@pytest.mark.parametrize(
    ("utc_hour", "start", "end", "quiet"),
    [
        (21, "22:00", "07:00", True),  # 22:00 Berlin: starts
        (20, "22:00", "07:00", False),  # 21:00
        (2, "22:00", "07:00", True),  # 03:00, across midnight
        (6, "22:00", "07:00", False),  # 07:00: ends
        (12, "13:00", "14:00", True),  # same-day window, 13:00
        (13, "13:00", "14:00", False),
        (12, "13:00", "13:00", False),  # equal start and end: none
    ],
)
def test_quiet_hours_in_the_users_zone(utc_hour: int, start: str, end: str, quiet: bool) -> None:
    assert in_quiet_hours(datetime(2026, 11, 18, utc_hour, 0, tzinfo=UTC), BERLIN, start, end) is quiet


def test_quiet_hours_follow_the_local_clock_across_dst() -> None:
    # 22:30 Berlin is 21:30 UTC in winter but 20:30 UTC in summer.
    assert in_quiet_hours(datetime(2026, 1, 10, 21, 30, tzinfo=UTC), BERLIN, "22:00", "07:00")
    assert in_quiet_hours(datetime(2026, 7, 10, 20, 30, tzinfo=UTC), BERLIN, "22:00", "07:00")
    assert not in_quiet_hours(datetime(2026, 7, 10, 19, 30, tzinfo=UTC), BERLIN, "22:00", "07:00")
