"""The data rules the database itself enforces (stage 04): ownership, consent, deletion, validity."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Activity, Category, Intention, IntentionAnalysis, Reminder, User
from app.schemas.user import UserPreferences
from tests.db_utils import migrate, run, require_test_database_url


@pytest.fixture(scope="module")
def db_url() -> str:
    url = require_test_database_url()
    migrate(url)
    return url


@pytest.fixture(autouse=True)
def clean(db_url: str):
    async def wipe(engine):
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users"))

    run(wipe, db_url)
    yield


def in_session(db_url: str, block):
    async def main(engine):
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            return await block(session)

    return run(main, db_url)


async def make_user(session: AsyncSession, name: str = "a", email: str | None = None) -> User:
    user = User(auth_subject=f"subject-{name}-{uuid.uuid4().hex[:6]}", email=email, timezone="Europe/Berlin")
    session.add(user)
    await session.flush()
    return user


async def make_intention(session: AsyncSession, user: User, **kw) -> Intention:
    intention = Intention(user_id=user.id, source_type="text", original_content="Try the ramen place", **kw)
    session.add(intention)
    await session.flush()
    return intention


def expect_integrity_error(db_url: str, block, constraint: str) -> None:
    async def attempt(session: AsyncSession):
        with pytest.raises(IntegrityError) as caught:
            await block(session)
            await session.flush()
        assert constraint in str(caught.value)

    in_session(db_url, attempt)


def test_defaults_on_capture(db_url: str) -> None:
    async def block(session):
        user = await make_user(session)
        intention = await make_intention(session, user)
        await session.commit()
        await session.refresh(intention)
        return intention

    intention = in_session(db_url, block)
    assert intention.status == "inbox"
    assert intention.analysis_status == "pending"
    assert intention.tags == [] and intention.field_states == {}
    assert intention.created_at.tzinfo is not None


def test_reminder_cannot_point_at_another_users_intention(db_url: str) -> None:
    async def block(session):
        alice, bob = await make_user(session, "alice"), await make_user(session, "bob")
        bobs_item = await make_intention(session, bob)
        session.add(Reminder(user_id=alice.id, intention_id=bobs_item.id, scheduled_at=datetime.now(UTC), timezone="UTC"))

    expect_integrity_error(db_url, block, "fk_reminders_intention_owner")


def test_activity_and_analysis_ownership_enforced(db_url: str) -> None:
    async def activity(session):
        alice, bob = await make_user(session, "alice"), await make_user(session, "bob")
        item = await make_intention(session, bob)
        session.add(Activity(user_id=alice.id, intention_id=item.id, event_type="captured"))

    expect_integrity_error(db_url, activity, "fk_activities_intention_owner")

    async def analysis(session):
        alice, bob = await make_user(session, "alice"), await make_user(session, "bob")
        item = await make_intention(session, bob)
        session.add(IntentionAnalysis(user_id=alice.id, intention_id=item.id))

    expect_integrity_error(db_url, analysis, "fk_intention_analyses_intention_owner")


def test_reminder_needs_approval_before_scheduling(db_url: str) -> None:
    async def block(session):
        user = await make_user(session)
        item = await make_intention(session, user)
        session.add(Reminder(user_id=user.id, intention_id=item.id, scheduled_at=datetime.now(UTC), timezone="UTC", status="scheduled"))

    expect_integrity_error(db_url, block, "ck_reminders_approved_before_scheduling")

    async def approved(session):
        user = await make_user(session)
        item = await make_intention(session, user)
        session.add(
            Reminder(
                user_id=user.id, intention_id=item.id, scheduled_at=datetime.now(UTC) + timedelta(days=1),
                timezone="Europe/Berlin", status="scheduled", approved_at=datetime.now(UTC),
            )
        )
        await session.commit()

    in_session(db_url, approved)


def test_deleting_intention_removes_its_reminders_activities_and_analyses(db_url: str) -> None:
    async def block(session):
        user = await make_user(session)
        item = await make_intention(session, user)
        session.add_all(
            [
                Reminder(user_id=user.id, intention_id=item.id, scheduled_at=datetime.now(UTC), timezone="UTC", status="scheduled", approved_at=datetime.now(UTC)),
                Activity(user_id=user.id, intention_id=item.id, event_type="captured"),
                IntentionAnalysis(user_id=user.id, intention_id=item.id),
            ]
        )
        await session.commit()
        await session.delete(item)
        await session.commit()
        counts = []
        for model in (Reminder, Activity, IntentionAnalysis):
            counts.append((await session.execute(select(func.count()).select_from(model))).scalar_one())
        return counts

    assert in_session(db_url, block) == [0, 0, 0]


def test_deleting_user_removes_everything_they_own(db_url: str) -> None:
    async def block(session):
        user = await make_user(session)
        item = await make_intention(session, user)
        session.add(Category(user_id=user.id, name="Garden", slug="garden"))
        session.add(Activity(user_id=user.id, intention_id=item.id, event_type="captured"))
        await session.commit()
        await session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user.id})
        await session.commit()
        totals = {}
        for model in (Intention, Activity):
            totals[model.__tablename__] = (await session.execute(select(func.count()).select_from(model))).scalar_one()
        totals["user_categories"] = (await session.execute(select(func.count()).select_from(Category).where(Category.user_id.is_not(None)))).scalar_one()
        totals["system_categories"] = (await session.execute(select(func.count()).select_from(Category).where(Category.user_id.is_(None)))).scalar_one()
        return totals

    assert in_session(db_url, block) == {"intentions": 0, "activities": 0, "user_categories": 0, "system_categories": 9}


def test_deleting_a_category_keeps_the_intention(db_url: str) -> None:
    async def block(session):
        user = await make_user(session)
        category = Category(user_id=user.id, name="Garden", slug="garden")
        session.add(category)
        await session.flush()
        item = await make_intention(session, user, category_id=category.id)
        await session.commit()
        await session.delete(category)
        await session.commit()
        await session.refresh(item)
        return item.category_id

    assert in_session(db_url, block) is None


@pytest.mark.parametrize(
    ("fields", "constraint"),
    [
        ({"source_type": "url"}, "ck_intentions_url_source_has_url"),
        ({"source_type": "url", "original_url": "javascript:alert(1)"}, "ck_intentions_original_url_scheme"),
        ({"source_type": "fax"}, "ck_intentions_source_type_valid"),
        ({"status": "deleted"}, "ck_intentions_status_valid"),
        ({"status": "completed"}, "ck_intentions_completed_has_timestamp"),
        ({"field_states": ["title"]}, "ck_intentions_field_states_is_object"),
        ({"tags": [f"t{i}" for i in range(21)]}, "ck_intentions_tags_max"),
    ],
)
def test_intention_validity_constraints(db_url: str, fields: dict, constraint: str) -> None:
    async def block(session):
        user = await make_user(session)
        params = {"source_type": "text", "original_content": "something", **fields}
        session.add(Intention(user_id=user.id, **params))

    expect_integrity_error(db_url, block, constraint)


def test_email_unique_case_insensitive(db_url: str) -> None:
    async def block(session):
        await make_user(session, "one", email="Ana@Example.com")
        await make_user(session, "two", email="ana@example.com")

    expect_integrity_error(db_url, block, "uq_users_email_lower")


def test_user_category_names_unique_per_user_not_globally(db_url: str) -> None:
    async def block(session):
        alice, bob = await make_user(session, "alice"), await make_user(session, "bob")
        session.add_all([Category(user_id=alice.id, name="Reading", slug="reading"), Category(user_id=bob.id, name="Reading", slug="reading")])
        await session.commit()

    in_session(db_url, block)  # same slug as a system category and across users: allowed

    async def duplicate(session):
        alice = await make_user(session, "carol")
        session.add_all([Category(user_id=alice.id, name="Garden", slug="garden"), Category(user_id=alice.id, name="Garden", slug="garden")])

    expect_integrity_error(db_url, duplicate, "uq_categories_user_slug")


def test_preferences_defaults_and_validation() -> None:
    prefs = UserPreferences.model_validate({})
    assert prefs.reminders.enabled and prefs.resurfacing.stale_after_days is None
    with pytest.raises(ValueError):
        UserPreferences.model_validate({"resurfacing": {"frequency": "hourly"}})
    with pytest.raises(ValueError):
        UserPreferences.model_validate({"unknown": True})
