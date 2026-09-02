"""Inspect RIDEX user indexes and constraints."""

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
                        indexname,
                        indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND tablename = 'users'
                    ORDER BY indexname;
                    """
                )
            )

            rows = result.mappings().all()

            print("=== USERS INDEXES ===")

            for row in rows:
                print()
                print(f"Index: {row['indexname']}")
                print(row["indexdef"])

            result = await connection.execute(
                text(
                    """
                    SELECT
                        conname,
                        pg_get_constraintdef(oid) AS definition
                    FROM pg_constraint
                    WHERE conrelid = 'public.users'::regclass
                    ORDER BY conname;
                    """
                )
            )

            rows = result.mappings().all()

            print()
            print("=== USERS CONSTRAINTS ===")

            for row in rows:
                print()
                print(f"Constraint: {row['conname']}")
                print(row["definition"])

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())