"""The resurfacing rules, as a pure function: no database, fixed clocks, real time zones."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.schemas.user import UserPreferences
from app.services.resurfacing import ItemSnapshot, condition_kind, evaluate, resolve_preset

BERLIN = "Europe/Berlin"
NOW = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)  # a Wednesday
DEFAULT = UserPreferences()


def item(**kw) -> ItemSnapshot:
    base = {"id": uuid.uuid4(), "status": "inbox", "created_at": NOW - timedelta(days=3)}
    base.update(kw)
    return ItemSnapshot(**base)


def ids(cands) -> list[uuid.UUID]:
    return [c.id for c in cands]


def prefs(**resurfacing) -> UserPreferences:
    return UserPreferences.model_validate({"resurfacing": resurfacing})


# --- explicit dates and snoozes -------------------------------------------------------------------


def test_a_date_the_user_chose_resurfaces_once_it_arrives() -> None:
    due = item(resurface_at=NOW - timedelta(hours=1))
    later = item(resurface_at=NOW + timedelta(hours=1))
    result = evaluate([due, later], DEFAULT, BERLIN, NOW)
    assert ids(result) == [due.id]
    assert result[0].signal == "date" and "today" in result[0].reason


def test_snoozed_items_never_appear_early_and_return_when_the_snooze_ends() -> None:
    sleeping = item(resurface_at=NOW - timedelta(days=1), snoozed_until=NOW + timedelta(minutes=1))
    assert evaluate([sleeping], DEFAULT, BERLIN, NOW) == []
    woke = item(snoozed_until=NOW - timedelta(minutes=1))
    result = evaluate([woke], DEFAULT, BERLIN, NOW)
    assert result[0].signal == "snooze"


def test_when_a_snooze_ends_after_a_date_the_snooze_explains_it() -> None:
    both = item(resurface_at=NOW - timedelta(days=5), snoozed_until=NOW - timedelta(hours=1))
    assert evaluate([both], DEFAULT, BERLIN, NOW)[0].signal == "snooze"
    date_later = item(snoozed_until=NOW - timedelta(days=5), resurface_at=NOW - timedelta(hours=1))
    assert evaluate([date_later], DEFAULT, BERLIN, NOW)[0].signal == "date"


@pytest.mark.parametrize("status", ["completed", "archived"])
def test_completed_and_archived_items_are_excluded(status: str) -> None:
    assert evaluate([item(status=status, resurface_at=NOW - timedelta(days=1))], DEFAULT, BERLIN, NOW) == []


def test_opening_an_item_after_it_came_due_clears_it() -> None:
    due = NOW - timedelta(days=1)
    assert evaluate([item(resurface_at=due, last_viewed_at=due + timedelta(hours=2))], DEFAULT, BERLIN, NOW) == []
    assert len(evaluate([item(resurface_at=due, last_viewed_at=due - timedelta(hours=2))], DEFAULT, BERLIN, NOW)) == 1


def test_dismissing_after_it_came_due_clears_it_but_a_new_date_brings_it_back() -> None:
    dismissed = NOW - timedelta(days=2)
    assert evaluate([item(resurface_at=NOW - timedelta(days=3), dismissed_at=dismissed)], DEFAULT, BERLIN, NOW) == []
    rescheduled = item(resurface_at=NOW - timedelta(hours=1), dismissed_at=dismissed)
    assert ids(evaluate([rescheduled], DEFAULT, BERLIN, NOW)) == [rescheduled.id]


def test_dates_and_snoozes_apply_even_when_suggestions_are_off() -> None:
    off = prefs(enabled=False)
    due = item(resurface_at=NOW - timedelta(hours=1))
    condition = item(resurface_condition="this evening", condition_state="accepted")
    assert ids(evaluate([due, condition], off, BERLIN, NOW.replace(hour=19))) == [due.id]


# --- conditions -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "kind"),
    [("this weekend", "weekend"), ("Saturday morning", "weekend"), ("tonight", "evening"), ("after work", "evening"),
     ("on a weekday", "weekday"), ("at lunch", "lunch"), ("before the March trip", None), (None, None)],
)
def test_condition_vocabulary(text, kind) -> None:
    assert condition_kind(text) == kind


def test_only_confirmed_conditions_trigger() -> None:
    saturday = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)  # 10:00 in Berlin
    suggested = item(resurface_condition="this weekend", condition_state="suggested")
    accepted = item(resurface_condition="this weekend", condition_state="accepted")
    edited = item(resurface_condition="this weekend", condition_state="edited")
    assert set(ids(evaluate([suggested, accepted, edited], DEFAULT, BERLIN, saturday))) == {accepted.id, edited.id}


def test_unrecognised_conditions_never_trigger() -> None:
    vague = item(resurface_condition="when I feel like it", condition_state="edited")
    assert evaluate([vague], DEFAULT, BERLIN, datetime(2026, 11, 21, 12, 0, tzinfo=UTC)) == []


def test_weekend_follows_the_users_time_zone_not_utc() -> None:
    weekend = item(resurface_condition="this weekend", condition_state="edited")
    # Sunday 23:30 UTC is already Monday 00:30 in Berlin: no longer the weekend there.
    late_sunday_utc = datetime(2026, 11, 22, 23, 30, tzinfo=UTC)
    assert evaluate([weekend], DEFAULT, BERLIN, late_sunday_utc) == []
    assert len(evaluate([weekend], DEFAULT, "America/New_York", late_sunday_utc)) == 1  # 18:30 Sunday there
    # Friday 23:30 UTC is Saturday 00:30 in Berlin: the weekend has started there.
    late_friday_utc = datetime(2026, 11, 20, 23, 30, tzinfo=UTC)
    assert len(evaluate([weekend], DEFAULT, BERLIN, late_friday_utc)) == 1


def test_evening_condition_across_a_daylight_saving_change() -> None:
    evening = item(resurface_condition="this evening", condition_state="accepted")
    # Berlin: 18:30 local is 16:30 UTC in summer (CEST) and 17:30 UTC in winter (CET).
    assert len(evaluate([evening], DEFAULT, BERLIN, datetime(2026, 7, 1, 16, 30, tzinfo=UTC))) == 1
    assert evaluate([evening], DEFAULT, BERLIN, datetime(2026, 12, 1, 16, 30, tzinfo=UTC)) == []  # 17:30 CET
    assert len(evaluate([evening], DEFAULT, BERLIN, datetime(2026, 12, 1, 17, 30, tzinfo=UTC))) == 1


def test_dismissed_conditions_are_suppressed_for_30_days() -> None:
    saturday = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    recently = item(resurface_condition="weekend", condition_state="edited", dismissed_at=saturday - timedelta(days=29))
    long_ago = item(resurface_condition="weekend", condition_state="edited", dismissed_at=saturday - timedelta(days=31))
    assert ids(evaluate([recently, long_ago], DEFAULT, BERLIN, saturday)) == [long_ago.id]


def test_frequency_cooldown_avoids_repeats_but_allows_the_same_day() -> None:
    saturday = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    shown_this_morning = item(resurface_condition="weekend", condition_state="edited", last_resurfaced_at=saturday - timedelta(hours=1))
    shown_last_week = item(resurface_condition="weekend", condition_state="edited", last_resurfaced_at=saturday - timedelta(days=7))
    shown_yesterday_sunday = item(resurface_condition="weekend", condition_state="edited", last_resurfaced_at=saturday - timedelta(days=1))
    weekly = prefs(frequency="weekly")
    assert set(ids(evaluate([shown_this_morning, shown_last_week, shown_yesterday_sunday], weekly, BERLIN, saturday))) == {
        shown_this_morning.id,
        shown_last_week.id,
    }
    daily = prefs(frequency="daily")
    assert len(evaluate([shown_yesterday_sunday], daily, BERLIN, saturday)) == 1


# --- stale ----------------------------------------------------------------------------------------


def test_stale_is_off_by_default_and_works_when_turned_on() -> None:
    old = item(created_at=NOW - timedelta(days=40))
    fresh = item(created_at=NOW - timedelta(days=5))
    viewed = item(created_at=NOW - timedelta(days=40), last_viewed_at=NOW - timedelta(days=2))
    assert evaluate([old], DEFAULT, BERLIN, NOW) == []
    result = evaluate([old, fresh, viewed], prefs(stale_after_days=30), BERLIN, NOW)
    assert ids(result) == [old.id] and "40 days" in result[0].reason


# --- ranking and determinism ----------------------------------------------------------------------


def test_ranking_is_transparent_and_stable() -> None:
    saturday = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    stale = item(created_at=saturday - timedelta(days=60))
    condition = item(resurface_condition="weekend", condition_state="edited")
    snooze = item(snoozed_until=saturday - timedelta(hours=2))
    old_date = item(resurface_at=saturday - timedelta(days=3))
    new_date = item(resurface_at=saturday - timedelta(hours=1))
    items = [stale, condition, snooze, new_date, old_date]
    result = evaluate(items, prefs(stale_after_days=30), BERLIN, saturday)
    assert ids(result) == [old_date.id, new_date.id, snooze.id, condition.id, stale.id]
    assert evaluate(list(reversed(items)), prefs(stale_after_days=30), BERLIN, saturday) == result  # order-independent


def test_results_are_capped() -> None:
    many = [item(resurface_at=NOW - timedelta(minutes=i)) for i in range(30)]
    assert len(evaluate(many, DEFAULT, BERLIN, NOW)) == 20


def test_naive_now_is_rejected() -> None:
    with pytest.raises(ValueError):
        evaluate([], DEFAULT, BERLIN, datetime(2026, 1, 1, 12, 0))


# --- presets --------------------------------------------------------------------------------------


def local(moment: datetime, tz: str) -> datetime:
    return moment.astimezone(ZoneInfo(tz))


def test_presets_are_wall_clock_times_in_the_users_zone() -> None:
    wednesday_noon_berlin = datetime(2026, 11, 18, 11, 0, tzinfo=UTC)
    assert local(resolve_preset("tomorrow", BERLIN, wednesday_noon_berlin), BERLIN).replace(tzinfo=None) == datetime(2026, 11, 19, 9, 0)
    assert local(resolve_preset("weekend", BERLIN, wednesday_noon_berlin), BERLIN).replace(tzinfo=None) == datetime(2026, 11, 21, 10, 0)
    assert local(resolve_preset("next_week", BERLIN, wednesday_noon_berlin), BERLIN).replace(tzinfo=None) == datetime(2026, 11, 23, 9, 0)
    assert local(resolve_preset("in_a_month", BERLIN, wednesday_noon_berlin), BERLIN).replace(tzinfo=None) == datetime(2026, 12, 18, 9, 0)


def test_weekend_preset_on_a_saturday_afternoon_means_next_weekend() -> None:
    saturday_afternoon = datetime(2026, 11, 21, 14, 0, tzinfo=UTC)
    assert local(resolve_preset("weekend", BERLIN, saturday_afternoon), BERLIN).date().isoformat() == "2026-11-28"
    saturday_early = datetime(2026, 11, 21, 6, 0, tzinfo=UTC)  # 07:00 Berlin
    assert local(resolve_preset("weekend", BERLIN, saturday_early), BERLIN).date().isoformat() == "2026-11-21"


def test_next_week_from_a_monday_is_the_following_monday() -> None:
    monday = datetime(2026, 11, 23, 10, 0, tzinfo=UTC)
    assert local(resolve_preset("next_week", BERLIN, monday), BERLIN).date().isoformat() == "2026-11-30"


def test_tomorrow_9am_across_a_daylight_saving_change() -> None:
    # Berlin springs forward on 2026-03-29 (02:00 -> 03:00). Tomorrow 9 am is still 9 am local,
    # which is 07:00 UTC (CEST) instead of 08:00 UTC the day before (CET).
    saturday_before = datetime(2026, 3, 28, 12, 0, tzinfo=UTC)
    result = resolve_preset("tomorrow", BERLIN, saturday_before)
    assert result == datetime(2026, 3, 29, 7, 0, tzinfo=UTC)
    assert local(result, BERLIN).hour == 9
    # New York falls back on 2026-11-01: 9 am local is 14:00 UTC (EST), not 13:00 UTC.
    assert resolve_preset("tomorrow", "America/New_York", datetime(2026, 10, 31, 16, 0, tzinfo=UTC)) == datetime(2026, 11, 1, 14, 0, tzinfo=UTC)
