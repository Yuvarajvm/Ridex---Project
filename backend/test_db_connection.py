"""Temporary manual checkpoint for Python -> SQLAlchemy -> PostgreSQL."""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings


async def test_connection() -> None:
    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))

    try:
        async with engine.connect() as connection:
            result = await connection.execute(text("SELECT 1"))
            print(f"Database connection successful: {result.scalar_one()}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(test_connection())
