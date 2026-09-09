"""Create notifications and trip_messages tables.

Revision ID: 20260909_0006
Revises: 20260909_0005
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260909_0006"
down_revision: str | Sequence[str] | None = "20260909_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create notifications and trip_messages tables with indexes."""

    # 1. Notifications table
    op.create_table(
        "notifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "is_read",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_notifications_user_id",
        "notifications",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_type",
        "notifications",
        ["type"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_is_read",
        "notifications",
        ["is_read"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_user_read",
        "notifications",
        ["user_id", "is_read"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_created_at",
        "notifications",
        ["created_at"],
        unique=False,
    )

    # 2. Trip messages table
    op.create_table(
        "trip_messages",
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
            sa.ForeignKey("rides.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_trip_messages_ride_id",
        "trip_messages",
        ["ride_id"],
        unique=False,
    )
    op.create_index(
        "ix_trip_messages_sender_id",
        "trip_messages",
        ["sender_id"],
        unique=False,
    )
    op.create_index(
        "ix_trip_messages_created_at",
        "trip_messages",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop trip_messages and notifications tables and indexes."""

    op.drop_index("ix_trip_messages_created_at", table_name="trip_messages")
    op.drop_index("ix_trip_messages_sender_id", table_name="trip_messages")
    op.drop_index("ix_trip_messages_ride_id", table_name="trip_messages")
    op.drop_table("trip_messages")

    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.drop_index("ix_notifications_type", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
