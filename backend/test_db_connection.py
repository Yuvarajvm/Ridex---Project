"""Simple PostgreSQL connectivity check for RIDEX."""

import asyncio

from sqlalchemy import text

from app.core.database import engine


async def main() -> None:
    """Verify that the configured database is reachable."""

    try:
        async with engine.connect() as connection:
            result = await connection.execute(text("SELECT 1"))
            value = result.scalar_one()

            print(f"Database connection successful: {value}")

    except Exception as exc:
        print(f"Database connection failed: {type(exc).__name__}: {exc}")
        raise

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())