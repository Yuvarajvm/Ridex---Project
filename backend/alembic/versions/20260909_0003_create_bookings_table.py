"""Create bookings table.

Revision ID: 20260909_0003
Revises: 20260903_0002
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260909_0003"
down_revision: str | Sequence[str] | None = "20260903_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create bookings table and supporting indexes."""

    op.create_table(
        "bookings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "ride_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rides.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "rider_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "seats_booked",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "total_fare",
            sa.Numeric(10, 2),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="confirmed",
        ),
        sa.Column(
            "cancellation_reason",
            sa.String(length=500),
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
            "seats_booked BETWEEN 1 AND 8",
            name="ck_bookings_seats_booked",
        ),
        sa.CheckConstraint(
            "total_fare >= 0",
            name="ck_bookings_total_fare_nonnegative",
        ),
        sa.CheckConstraint(
            "status IN ('requested', 'confirmed', 'rejected', 'cancelled', 'completed')",
            name="ck_bookings_status",
        ),
    )

    op.create_index(
        "ix_bookings_ride_id",
        "bookings",
        ["ride_id"],
    )
    op.create_index(
        "ix_bookings_rider_id",
        "bookings",
        ["rider_id"],
    )
    op.create_index(
        "ix_bookings_status",
        "bookings",
        ["status"],
    )
    op.create_index(
        "ix_bookings_ride_rider",
        "bookings",
        ["ride_id", "rider_id"],
    )


def downgrade() -> None:
    """Drop bookings table and indexes."""

    op.drop_index("ix_bookings_ride_rider", table_name="bookings")
    op.drop_index("ix_bookings_status", table_name="bookings")
    op.drop_index("ix_bookings_rider_id", table_name="bookings")
    op.drop_index("ix_bookings_ride_id", table_name="bookings")
    op.drop_table("bookings")
