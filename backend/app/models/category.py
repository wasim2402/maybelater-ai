from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPrimaryKey


class Category(UUIDPrimaryKey, Timestamps, Base):
    """A grouping for intentions. `user_id IS NULL` marks a system category (seeded by migration,
    shared by everyone, read-only); otherwise it belongs to one user."""

    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) BETWEEN 1 AND 60", name="name_length"),
        CheckConstraint("slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name="slug_format"),
        # Names are unique per owner, case-insensitively: once among system categories, once per user.
        Index("uq_categories_system_slug", "slug", unique=True, postgresql_where=text("user_id IS NULL")),
        Index("uq_categories_user_slug", "user_id", "slug", unique=True, postgresql_where=text("user_id IS NOT NULL")),
        Index("ix_categories_user_name_lower", "user_id", func.lower(text("name"))),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str | None] = mapped_column(String(240))
    icon_key: Mapped[str | None] = mapped_column(String(40))

    @property
    def is_system(self) -> bool:
        return self.user_id is None
