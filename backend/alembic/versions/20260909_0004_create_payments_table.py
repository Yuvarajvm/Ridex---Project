"""Create payments table.

Revision ID: 20260909_0004
Revises: 20260909_0003
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260909_0004"
down_revision: str | Sequence[str] | None = "20260909_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create payments table and supporting indexes."""

    op.create_table(
        "payments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "payer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Numeric(10, 2),
            nullable=False,
        ),
        sa.Column(
            "currency",
            sa.String(length=10),
            nullable=False,
            server_default="INR",
        ),
        sa.Column(
            "provider",
            sa.String(length=50),
            nullable=False,
            server_default="mock",
        ),
        sa.Column(
            "provider_payment_id",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "provider_order_id",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "error_message",
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
            "amount >= 0",
            name="ck_payments_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')",
            name="ck_payments_status",
        ),
    )

    op.create_index(
        "ix_payments_booking_id",
        "payments",
        ["booking_id"],
    )
    op.create_index(
        "ix_payments_payer_id",
        "payments",
        ["payer_id"],
    )
    op.create_index(
        "ix_payments_status",
        "payments",
        ["status"],
    )


def downgrade() -> None:
    """Drop payments table and indexes."""

    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_payer_id", table_name="payments")
    op.drop_index("ix_payments_booking_id", table_name="payments")
    op.drop_table("payments")
