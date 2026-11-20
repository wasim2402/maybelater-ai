# Import every model module here so Alembic autogenerate can discover it.
from app.db.base import Base

__all__ = ["Base"]
