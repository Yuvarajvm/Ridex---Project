"""Database integrity tests for the RIDEX foundation schema."""

import asyncio
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

from app.core.config import get_settings


async def expect_constraint_failure(
    connection: AsyncConnection,
    statement,
    parameters: dict,
    expected_constraint: str,
    success_message: str,
    failure_message: str,
) -> None:
    """
    Execute a statement that must fail.

    A SAVEPOINT isolates the expected PostgreSQL constraint violation so
    the outer transaction remains usable for subsequent tests.
    """
    savepoint = await connection.begin_nested()

    try:
        await connection.execute(statement, parameters)
    except Exception as exc:
        await savepoint.rollback()

        message = str(exc)

        if expected_constraint not in message:
            raise AssertionError(
                f"{failure_message}: expected PostgreSQL constraint "
                f"'{expected_constraint}', but received:\n{message}"
            ) from exc

        print(success_message)
    else:
        await savepoint.rollback()
        raise AssertionError(failure_message)


async def create_test_user(
    connection: AsyncConnection,
    user_id: UUID,
    email: str = "test@example.com",
) -> None:
    await connection.execute(
        text(
            """
            INSERT INTO users (
                id,
                email,
                password_hash,
                role,
                status
            )
            VALUES (
                :id,
                :email,
                'test-password-hash',
                'rider',
                'pending_verification'
            );
            """
        ),
        {
            "id": user_id,
            "email": email,
        },
    )


async def main() -> None:
    settings = get_settings()

    engine = create_async_engine(
        str(settings.database_url),
        echo=False,
    )

    user_id = uuid4()
    profile_id = uuid4()
    vehicle_id = uuid4()

    try:
        async with engine.begin() as connection:
            # ----------------------------------------------------------
            # 1. Required foundation tables exist
            # ----------------------------------------------------------

            result = await connection.execute(
                text(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name IN (
                          'users',
                          'profiles',
                          'vehicles'
                      )
                    ORDER BY table_name;
                    """
                )
            )

            tables = {row[0] for row in result.fetchall()}

            required_tables = {
                "users",
                "profiles",
                "vehicles",
            }

            assert required_tables.issubset(tables), (
                "Required foundation tables are missing"
            )

            print("[PASS] Required foundation tables exist")

            # ----------------------------------------------------------
            # 2. Migration version
            # ----------------------------------------------------------

            result = await connection.execute(
                text(
                    """
                    SELECT version_num
                    FROM alembic_version;
                    """
                )
            )

            version = result.scalar_one()

            assert version == "20260902_0001", (
                f"Unexpected migration version: {version}"
            )

            print("[PASS] Database is at migration 20260902_0001")

            # ----------------------------------------------------------
            # 3. User email normalization
            # ----------------------------------------------------------

            await create_test_user(
                connection,
                user_id,
                email="  TEST@EXAMPLE.COM  ",
            )

            result = await connection.execute(
                text(
                    """
                    SELECT email
                    FROM users
                    WHERE id = :id;
                    """
                ),
                {"id": user_id},
            )

            normalized_email = result.scalar_one()

            assert normalized_email == "test@example.com", (
                f"User email was not normalized: {normalized_email!r}"
            )

            print("[PASS] User email normalization")

            # ----------------------------------------------------------
            # 4. users.updated_at PostgreSQL trigger
            # ----------------------------------------------------------

            result = await connection.execute(
                text(
                    """
                    SELECT updated_at
                    FROM users
                    WHERE id = :id;
                    """
                ),
                {"id": user_id},
            )

            original_updated_at = result.scalar_one()

            await asyncio.sleep(0.1)

            await connection.execute(
                text(
                    """
                    UPDATE users
                    SET email_verified_at = clock_timestamp()
                    WHERE id = :id;
                    """
                ),
                {"id": user_id},
            )

            result = await connection.execute(
                text(
                    """
                    SELECT updated_at
                    FROM users
                    WHERE id = :id;
                    """
                ),
                {"id": user_id},
            )

            new_updated_at = result.scalar_one()

            assert new_updated_at > original_updated_at, (
                "updated_at trigger did not update the timestamp"
            )

            print("[PASS] users.updated_at PostgreSQL trigger")

            # ----------------------------------------------------------
            # 5. Active user + deleted_at must be rejected
            # ----------------------------------------------------------

            await connection.execute(
                text(
                    """
                    UPDATE users
                    SET status = 'active'
                    WHERE id = :id;
                    """
                ),
                {"id": user_id},
            )

            await expect_constraint_failure(
                connection,
                text(
                    """
                    UPDATE users
                    SET deleted_at = clock_timestamp()
                    WHERE id = :id;
                    """
                ),
                {"id": user_id},
                expected_constraint="ck_users_active_requires_not_deleted",
                success_message="[PASS] Active user cannot have deleted_at",
                failure_message=(
                    "Database allowed active user with deleted_at set"
                ),
            )

            # ----------------------------------------------------------
            # 6. Duplicate active email must be rejected
            # ----------------------------------------------------------

            await expect_constraint_failure(
                connection,
                text(
                    """
                    INSERT INTO users (
                        id,
                        email,
                        password_hash,
                        role,
                        status
                    )
                    VALUES (
                        :id,
                        'test@example.com',
                        'another-password-hash',
                        'rider',
                        'pending_verification'
                    );
                    """
                ),
                {"id": uuid4()},
                expected_constraint="ix_users_email_active_unique",
                success_message="[PASS] Duplicate active email rejected",
                failure_message=(
                    "Database allowed duplicate non-deleted email"
                ),
            )

            # ----------------------------------------------------------
            # 7. Create a profile
            # ----------------------------------------------------------

            await connection.execute(
                text(
                    """
                    INSERT INTO profiles (
                        id,
                        user_id,
                        first_name
                    )
                    VALUES (
                        :id,
                        :user_id,
                        'Yuvaraj'
                    );
                    """
                ),
                {
                    "id": profile_id,
                    "user_id": user_id,
                },
            )

            print("[PASS] Valid profile insertion")

            # ----------------------------------------------------------
            # 8. Profile must be one-to-one
            # ----------------------------------------------------------

            await expect_constraint_failure(
                connection,
                text(
                    """
                    INSERT INTO profiles (
                        id,
                        user_id,
                        first_name
                    )
                    VALUES (
                        :id,
                        :user_id,
                        'Duplicate'
                    );
                    """
                ),
                {
                    "id": uuid4(),
                    "user_id": user_id,
                },
                expected_constraint="ux_profiles_user_id",
                success_message="[PASS] Profile one-to-one constraint",
                failure_message=(
                    "Database allowed multiple profiles for one user"
                ),
            )

            # ----------------------------------------------------------
            # 9. Vehicle registration normalization
            # ----------------------------------------------------------

            await connection.execute(
                text(
                    """
                    INSERT INTO vehicles (
                        id,
                        owner_id,
                        vehicle_type,
                        make,
                        model,
                        registration_number,
                        seat_capacity
                    )
                    VALUES (
                        :id,
                        :owner_id,
                        'car',
                        'Toyota',
                        'Innova',
                        :registration_number,
                        7
                    );
                    """
                ),
                {
                    "id": vehicle_id,
                    "owner_id": user_id,
                    "registration_number": " ap39ab1234 ",
                },
            )

            result = await connection.execute(
                text(
                    """
                    SELECT registration_number
                    FROM vehicles
                    WHERE id = :id;
                    """
                ),
                {"id": vehicle_id},
            )

            registration_number = result.scalar_one()

            assert registration_number == "AP39AB1234", (
                "Vehicle registration was not normalized"
            )

            print("[PASS] Vehicle registration normalization")

            # ----------------------------------------------------------
            # 10. Duplicate active registration must be rejected
            # ----------------------------------------------------------

            await expect_constraint_failure(
                connection,
                text(
                    """
                    INSERT INTO vehicles (
                        id,
                        owner_id,
                        vehicle_type,
                        make,
                        model,
                        registration_number,
                        seat_capacity
                    )
                    VALUES (
                        :id,
                        :owner_id,
                        'car',
                        'Honda',
                        'City',
                        'AP39AB1234',
                        5
                    );
                    """
                ),
                {
                    "id": uuid4(),
                    "owner_id": user_id,
                },
                expected_constraint="ix_vehicles_registration_number_active_unique",
                success_message=(
                    "[PASS] Duplicate active registration rejected"
                ),
                failure_message=(
                    "Database allowed duplicate active registration number"
                ),
            )

            # ----------------------------------------------------------
            # 11. Invalid seat capacity must be rejected
            # ----------------------------------------------------------

            await expect_constraint_failure(
                connection,
                text(
                    """
                    INSERT INTO vehicles (
                        id,
                        owner_id,
                        vehicle_type,
                        make,
                        model,
                        registration_number,
                        seat_capacity
                    )
                    VALUES (
                        :id,
                        :owner_id,
                        'car',
                        'Test',
                        'Invalid',
                        'INVALID999',
                        0
                    );
                    """
                ),
                {
                    "id": uuid4(),
                    "owner_id": user_id,
                },
                expected_constraint="ck_vehicles_seat_capacity",
                success_message=(
                    "[PASS] Invalid vehicle seat capacity rejected"
                ),
                failure_message=(
                    "Database allowed invalid seat capacity"
                ),
            )

            # ----------------------------------------------------------
            # 12. Verified vehicle requires verified_at
            # ----------------------------------------------------------

            await expect_constraint_failure(
                connection,
                text(
                    """
                    INSERT INTO vehicles (
                        id,
                        owner_id,
                        vehicle_type,
                        make,
                        model,
                        registration_number,
                        seat_capacity,
                        verification_status
                    )
                    VALUES (
                        :id,
                        :owner_id,
                        'car',
                        'Test',
                        'Verified',
                        'VERIFY123',
                        5,
                        'verified'
                    );
                    """
                ),
                {
                    "id": uuid4(),
                    "owner_id": user_id,
                },
                expected_constraint="ck_vehicles_verified_requires_timestamp",
                success_message=(
                    "[PASS] Verified vehicle requires verified_at"
                ),
                failure_message=(
                    "Database allowed verified vehicle without verified_at"
                ),
            )

            # ----------------------------------------------------------
            # 13. Rejected vehicle requires rejection reason
            # ----------------------------------------------------------

            await expect_constraint_failure(
                connection,
                text(
                    """
                    INSERT INTO vehicles (
                        id,
                        owner_id,
                        vehicle_type,
                        make,
                        model,
                        registration_number,
                        seat_capacity,
                        verification_status
                    )
                    VALUES (
                        :id,
                        :owner_id,
                        'car',
                        'Test',
                        'Rejected',
                        'REJECT123',
                        5,
                        'rejected'
                    );
                    """
                ),
                {
                    "id": uuid4(),
                    "owner_id": user_id,
                },
                expected_constraint="ck_vehicles_rejected_requires_reason",
                success_message=(
                    "[PASS] Rejected vehicle requires reason"
                ),
                failure_message=(
                    "Database allowed rejected vehicle without reason"
                ),
            )

            # ----------------------------------------------------------
            # 14. Invalid foreign key must be rejected
            # ----------------------------------------------------------

            await expect_constraint_failure(
                connection,
                text(
                    """
                    INSERT INTO vehicles (
                        id,
                        owner_id,
                        vehicle_type,
                        make,
                        model,
                        registration_number,
                        seat_capacity
                    )
                    VALUES (
                        :id,
                        :owner_id,
                        'car',
                        'Test',
                        'Invalid Owner',
                        'NOOWNER123',
                        5
                    );
                    """
                ),
                {
                    "id": uuid4(),
                    "owner_id": uuid4(),
                },
                expected_constraint="vehicles_owner_id_fkey",
                success_message=(
                    "[PASS] Invalid vehicle owner foreign key rejected"
                ),
                failure_message=(
                    "Database allowed vehicle with nonexistent owner"
                ),
            )

            # ----------------------------------------------------------
            # Final cleanup
            # ----------------------------------------------------------

            await connection.execute(
                text(
                    """
                    DELETE FROM vehicles
                    WHERE id = :id;
                    """
                ),
                {"id": vehicle_id},
            )

            await connection.execute(
                text(
                    """
                    DELETE FROM profiles
                    WHERE id = :id;
                    """
                ),
                {"id": profile_id},
            )

            await connection.execute(
                text(
                    """
                    DELETE FROM users
                    WHERE id = :id;
                    """
                ),
                {"id": user_id},
            )

            print()
            print("=" * 60)
            print("RIDEX DATABASE INTEGRITY TESTS PASSED")
            print("=" * 60)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())