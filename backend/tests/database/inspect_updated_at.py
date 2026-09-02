"""Inspect RIDEX updated_at trigger functions and behavior."""

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
            print("=== TRIGGER FUNCTIONS ===")

            result = await connection.execute(
                text(
                    """
                    SELECT
                        p.proname AS function_name,
                        pg_get_functiondef(p.oid) AS function_definition
                    FROM pg_proc p
                    JOIN pg_namespace n
                      ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public'
                      AND p.proname IN (
                          'ridex_set_updated_at',
                          'ridex_normalize_user_email',
                          'ridex_normalize_registration_number'
                      )
                    ORDER BY p.proname;
                    """
                )
            )

            rows = result.mappings().all()

            if not rows:
                print("NO RIDEX FUNCTIONS FOUND")
            else:
                for row in rows:
                    print()
                    print(f"Function: {row['function_name']}")
                    print(row["function_definition"])

            print()
            print("=== UPDATED_AT COLUMN DEFINITIONS ===")

            result = await connection.execute(
                text(
                    """
                    SELECT
                        table_name,
                        column_name,
                        data_type,
                        column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name IN (
                          'users',
                          'profiles',
                          'vehicles'
                      )
                      AND column_name = 'updated_at'
                    ORDER BY table_name;
                    """
                )
            )

            rows = result.mappings().all()

            for row in rows:
                print()
                print(f"Table:   {row['table_name']}")
                print(f"Column:  {row['column_name']}")
                print(f"Type:    {row['data_type']}")
                print(f"Default: {row['column_default']}")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())