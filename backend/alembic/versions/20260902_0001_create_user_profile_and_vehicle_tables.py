"""Create user, profile, and vehicle tables.

Revision ID: 20260902_0001
Revises:
Create Date: 2026-09-02
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260902_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # USERS
    # ------------------------------------------------------------------

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.String(length=30),
            server_default="rider",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="pending_verification",
            nullable=False,
        ),
        sa.Column(
            "email_verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "phone_verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "locked_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            "email = lower(trim(email))",
            name="ck_users_email_normalized",
        ),
        sa.CheckConstraint(
            "length(trim(email)) > 0",
            name="ck_users_email_nonempty",
        ),
        sa.CheckConstraint(
            "length(trim(password_hash)) > 0",
            name="ck_users_password_hash_nonempty",
        ),
        sa.CheckConstraint(
            "failed_login_attempts >= 0",
            name="ck_users_failed_login_attempts_nonnegative",
        ),
        sa.CheckConstraint(
            "role IN ('rider', 'driver', 'admin')",
            name="ck_users_role",
        ),
        sa.CheckConstraint(
            "status IN "
            "('pending_verification', 'active', 'suspended', 'deactivated')",
            name="ck_users_status",
        ),
        sa.CheckConstraint(
            "NOT (status = 'active' AND deleted_at IS NOT NULL)",
            name="ck_users_active_requires_not_deleted",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_users_email_active_unique",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_index(
        "ix_users_phone_number_active_unique",
        "users",
        ["phone_number"],
        unique=True,
        postgresql_where=sa.text(
            "phone_number IS NOT NULL AND deleted_at IS NULL"
        ),
    )

    op.create_index(
        "ix_users_status",
        "users",
        ["status"],
    )

    op.create_index(
        "ix_users_role",
        "users",
        ["role"],
    )

    op.create_index(
        "ix_users_created_at",
        "users",
        ["created_at"],
    )

    # ------------------------------------------------------------------
    # PROFILES
    # ------------------------------------------------------------------

    op.create_table(
        "profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=True),
        sa.Column("display_name", sa.String(length=160), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("bio", sa.String(length=500), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=30), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column(
            "country",
            sa.String(length=120),
            server_default="India",
            nullable=False,
        ),
        sa.Column(
            "profile_completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            "length(trim(first_name)) > 0",
            name="ck_profiles_first_name_nonempty",
        ),
        sa.CheckConstraint(
            "display_name IS NULL OR length(trim(display_name)) > 0",
            name="ck_profiles_display_name_nonempty",
        ),
        sa.CheckConstraint(
            "gender IS NULL OR gender IN "
            "('male', 'female', 'non_binary', 'prefer_not_to_say')",
            name="ck_profiles_gender",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # One user -> one profile.
    #
    # This is intentionally NOT a partial unique index. A soft-deleted
    # profile remains the user's historical profile and must be restored
    # instead of creating a second profile row.
    op.create_index(
        "ux_profiles_user_id",
        "profiles",
        ["user_id"],
        unique=True,
    )

    op.create_index(
        "ix_profiles_city",
        "profiles",
        ["city"],
    )

    op.create_index(
        "ix_profiles_state",
        "profiles",
        ["state"],
    )

    op.create_index(
        "ix_profiles_created_at",
        "profiles",
        ["created_at"],
    )

    # ------------------------------------------------------------------
    # VEHICLES
    # ------------------------------------------------------------------

    op.create_table(
        "vehicles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("vehicle_type", sa.String(length=30), nullable=False),
        sa.Column("make", sa.String(length=100), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=60), nullable=True),
        sa.Column(
            "registration_number",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "registration_state",
            sa.String(length=120),
            nullable=True,
        ),
        sa.Column(
            "manufacture_year",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "seat_capacity",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "verification_status",
            sa.String(length=30),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "rejected_reason",
            sa.String(length=500),
            nullable=True,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            "vehicle_type IN ('car', 'bike', 'auto', 'van')",
            name="ck_vehicles_type",
        ),
        sa.CheckConstraint(
            "length(trim(registration_number)) > 0",
            name="ck_vehicles_registration_nonempty",
        ),
        sa.CheckConstraint(
            "registration_number = upper(trim(registration_number))",
            name="ck_vehicles_registration_normalized",
        ),
        sa.CheckConstraint(
            "seat_capacity BETWEEN 1 AND 8",
            name="ck_vehicles_seat_capacity",
        ),
        sa.CheckConstraint(
            "manufacture_year IS NULL OR manufacture_year >= 1990",
            name="ck_vehicles_manufacture_year",
        ),
        sa.CheckConstraint(
            "verification_status IN "
            "('pending', 'verified', 'rejected', 'expired')",
            name="ck_vehicles_verification_status",
        ),
        sa.CheckConstraint(
            "verification_status != 'verified' "
            "OR verified_at IS NOT NULL",
            name="ck_vehicles_verified_requires_timestamp",
        ),
        sa.CheckConstraint(
            "verification_status != 'rejected' "
            "OR rejected_reason IS NOT NULL",
            name="ck_vehicles_rejected_requires_reason",
        ),
        sa.CheckConstraint(
            "verification_status = 'rejected' "
            "OR rejected_reason IS NULL",
            name="ck_vehicles_rejected_reason_only_when_rejected",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_vehicles_owner_id",
        "vehicles",
        ["owner_id"],
    )

    op.create_index(
        "ix_vehicles_registration_number_active_unique",
        "vehicles",
        ["registration_number"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_index(
        "ix_vehicles_verification_status",
        "vehicles",
        ["verification_status"],
    )

    op.create_index(
        "ix_vehicles_is_active",
        "vehicles",
        ["is_active"],
    )

    op.create_index(
        "ix_vehicles_created_at",
        "vehicles",
        ["created_at"],
    )

    # ------------------------------------------------------------------
    # DATABASE TRIGGERS
    # ------------------------------------------------------------------
    #
    # These make important normalization/lifecycle behavior safe even
    # when PostgreSQL is modified outside SQLAlchemy.
    #

    op.execute(
        """
        CREATE OR REPLACE FUNCTION ridex_set_updated_at()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = clock_timestamp();
            RETURN NEW;
        END;
        $$;
        """
    )

    for table_name in ("users", "profiles", "vehicles"):
        op.execute(
            f"""
            CREATE TRIGGER trg_{table_name}_updated_at
            BEFORE UPDATE ON {table_name}
            FOR EACH ROW
            EXECUTE FUNCTION ridex_set_updated_at();
            """
        )

    # Normalize account email at the database boundary.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION ridex_normalize_user_email()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.email = lower(trim(NEW.email));
            RETURN NEW;
        END;
        $$;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_users_normalize_email
        BEFORE INSERT OR UPDATE OF email ON users
        FOR EACH ROW
        EXECUTE FUNCTION ridex_normalize_user_email();
        """
    )

    # Normalize vehicle registration numbers at the database boundary.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION ridex_normalize_registration_number()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.registration_number =
                upper(trim(NEW.registration_number));
            RETURN NEW;
        END;
        $$;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_vehicles_normalize_registration_number
        BEFORE INSERT OR UPDATE OF registration_number ON vehicles
        FOR EACH ROW
        EXECUTE FUNCTION ridex_normalize_registration_number();
        """
    )


def downgrade() -> None:
    # Remove table-specific triggers first.
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_users_normalize_email ON users;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS
        trg_vehicles_normalize_registration_number
        ON vehicles;
        """
    )

    op.execute(
        """
        DROP FUNCTION IF EXISTS ridex_set_updated_at();
        """
    )

    op.execute(
        """
        DROP FUNCTION IF EXISTS ridex_normalize_user_email();
        """
    )

    op.execute(
        """
        DROP FUNCTION IF EXISTS ridex_normalize_registration_number();
        """
    )

    op.drop_table("vehicles")
    op.drop_table("profiles")
    op.drop_table("users")