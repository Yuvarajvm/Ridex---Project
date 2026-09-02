"""Inspect RIDEX PostgreSQL triggers."""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings


async def main() -> None:
    settings = get_settings()

    engine = create_async_engine(
        str(settings.database_url),
        echo=False,
    )

    try:
        async with engine.connect() as connection:
            result = await connection.execute(
                text(
                    """
                    SELECT
                        event_object_table AS table_name,
                        trigger_name,
                        action_timing,
                        event_manipulation,
                        action_statement
                    FROM information_schema.triggers
                    WHERE trigger_schema = 'public'
                      AND event_object_table IN (
                          'users',
                          'profiles',
                          'vehicles'
                      )
                    ORDER BY event_object_table, trigger_name;
                    """
                )
            )

            rows = result.mappings().all()

            if not rows:
                print("NO RIDEX TRIGGERS FOUND")
                return

            for row in rows:
                print()
                print(f"Table:      {row['table_name']}")
                print(f"Trigger:    {row['trigger_name']}")
                print(f"Timing:     {row['action_timing']}")
                print(f"Event:      {row['event_manipulation']}")
                print(f"Action:     {row['action_statement']}")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())