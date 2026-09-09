"""Alembic migration environment for RIDEX."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.shared.database import Base

# Register all implemented ORM models before Alembic reads Base.metadata.
from app.modules.api.v1.bookings.models import Booking  # noqa: F401
from app.modules.api.v1.messaging.models import TripMessage  # noqa: F401
from app.modules.api.v1.notifications.models import Notification  # noqa: F401
from app.modules.api.v1.payments.models import Payment  # noqa: F401
from app.modules.api.v1.reviews.models import Review  # noqa: F401
from app.modules.api.v1.rides.models import Ride  # noqa: F401
from app.modules.api.v1.safety.models import IncidentReport  # noqa: F401
from app.modules.api.v1.users.models import Profile, User  # noqa: F401
from app.modules.api.v1.vehicles.models import Vehicle  # noqa: F401


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option(
    "sqlalchemy.url",
    str(get_settings().database_url),
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without creating a database connection."""

    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations using an existing synchronous connection."""

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations using SQLAlchemy's async engine."""

    connectable = async_engine_from_config(
        config.get_section(
            config.config_ini_section,
            {},
        ),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())