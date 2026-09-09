"""Create incident_reports table.

Revision ID: 20260909_0007
Revises: 20260909_0006
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260909_0007"
down_revision: str | Sequence[str] | None = "20260909_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create incident_reports table and indexes."""

    op.create_table(
        "incident_reports",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "reporter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reported_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "ride_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rides.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column(
            "resolved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "status IN ('pending', 'investigating', 'resolved', 'dismissed')",
            name="ck_incident_reports_status",
        ),
    )

    op.create_index(
        "ix_incident_reports_reporter_id",
        "incident_reports",
        ["reporter_id"],
        unique=False,
    )
    op.create_index(
        "ix_incident_reports_reported_user_id",
        "incident_reports",
        ["reported_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_incident_reports_ride_id",
        "incident_reports",
        ["ride_id"],
        unique=False,
    )
    op.create_index(
        "ix_incident_reports_status",
        "incident_reports",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_incident_reports_created_at",
        "incident_reports",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop incident_reports table and indexes."""

    op.drop_index("ix_incident_reports_created_at", table_name="incident_reports")
    op.drop_index("ix_incident_reports_status", table_name="incident_reports")
    op.drop_index("ix_incident_reports_ride_id", table_name="incident_reports")
    op.drop_index("ix_incident_reports_reported_user_id", table_name="incident_reports")
    op.drop_index("ix_incident_reports_reporter_id", table_name="incident_reports")
    op.drop_table("incident_reports")
