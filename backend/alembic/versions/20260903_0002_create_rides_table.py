"""Create rides table.

Revision ID: 20260903_0002
Revises: 20260902_0001
Create Date: 2026-09-03
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260903_0002"
down_revision: str | Sequence[str] | None = "20260902_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create rides table and supporting indexes."""

    op.create_table(
        "rides",
        sa.Column(
            "driver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "vehicle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vehicles.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "origin",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "destination",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "departure_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "available_seats",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "price_per_seat",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="scheduled",
            nullable=False,
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            "length(trim(origin)) > 0",
            name="ck_rides_origin_nonempty",
        ),
        sa.CheckConstraint(
            "length(trim(destination)) > 0",
            name="ck_rides_destination_nonempty",
        ),
        sa.CheckConstraint(
            "origin <> destination",
            name="ck_rides_origin_destination_different",
        ),
        sa.CheckConstraint(
            "departure_at > created_at",
            name="ck_rides_departure_after_creation",
        ),
        sa.CheckConstraint(
            "available_seats BETWEEN 1 AND 8",
            name="ck_rides_available_seats",
        ),
        sa.CheckConstraint(
            "price_per_seat >= 10",
            name="ck_rides_minimum_price",
        ),
        sa.CheckConstraint(
            "status IN ('scheduled', 'in_progress', 'completed', 'cancelled')",
            name="ck_rides_status",
        ),
    )

    op.create_index(
        "ix_rides_driver_id",
        "rides",
        ["driver_id"],
    )
    op.create_index(
        "ix_rides_vehicle_id",
        "rides",
        ["vehicle_id"],
    )
    op.create_index(
        "ix_rides_origin",
        "rides",
        ["origin"],
    )
    op.create_index(
        "ix_rides_destination",
        "rides",
        ["destination"],
    )
    op.create_index(
        "ix_rides_departure_at",
        "rides",
        ["departure_at"],
    )
    op.create_index(
        "ix_rides_status",
        "rides",
        ["status"],
    )
    op.create_index(
        "ix_rides_marketplace_search",
        "rides",
        ["origin", "destination", "departure_at"],
    )

    # Keep updated_at correct even when rows are modified by direct SQL.
    op.execute(
        """
        CREATE TRIGGER trg_rides_updated_at
        BEFORE UPDATE ON rides
        FOR EACH ROW
        EXECUTE FUNCTION ridex_set_updated_at();
        """
    )

    # Normalize textual locations at the database boundary.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION ridex_normalize_ride_locations()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.origin = trim(NEW.origin);
            NEW.destination = trim(NEW.destination);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_rides_normalize_locations
        BEFORE INSERT OR UPDATE ON rides
        FOR EACH ROW
        EXECUTE FUNCTION ridex_normalize_ride_locations();
        """
    )


def downgrade() -> None:
    """Drop rides table and supporting database objects."""

    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_rides_normalize_locations
        ON rides;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_rides_updated_at
        ON rides;
        """
    )

    op.execute(
        """
        DROP FUNCTION IF EXISTS ridex_normalize_ride_locations();
        """
    )

    op.drop_index("ix_rides_marketplace_search", table_name="rides")
    op.drop_index("ix_rides_status", table_name="rides")
    op.drop_index("ix_rides_departure_at", table_name="rides")
    op.drop_index("ix_rides_destination", table_name="rides")
    op.drop_index("ix_rides_origin", table_name="rides")
    op.drop_index("ix_rides_vehicle_id", table_name="rides")
    op.drop_index("ix_rides_driver_id", table_name="rides")

    op.drop_table("rides")