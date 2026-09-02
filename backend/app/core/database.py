"""SQLAlchemy database primitives shared by all RIDEX modules."""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.shared.database import Base


settings = get_settings()


engine = create_async_engine(
    str(settings.database_url),
    echo=settings.sql_echo,
    pool_pre_ping=True,
)


AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Provide a database session for a request.

    Transactions are rolled back automatically when an exception escapes
    the request handler.
    """

    async with AsyncSessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def check_database_connection() -> bool:
    """Return True when the PostgreSQL connection is working."""

    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

        return True

    except Exception:
        return False


async def close_database_connection() -> None:
    """Dispose all SQLAlchemy database connections."""

    await engine.dispose()