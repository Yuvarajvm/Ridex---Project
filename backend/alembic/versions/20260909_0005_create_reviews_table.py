"""Create reviews table.

Revision ID: 20260909_0005
Revises: 20260909_0004
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260909_0005"
down_revision: str | Sequence[str] | None = "20260909_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create reviews table and supporting indexes."""

    op.create_table(
        "reviews",
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
            "reviewer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "reviewee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "rating",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "comment",
            sa.String(length=1000),
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
            "rating BETWEEN 1 AND 5",
            name="ck_reviews_rating_range",
        ),
        sa.CheckConstraint(
            "reviewer_id != reviewee_id",
            name="ck_reviews_no_self_review",
        ),
    )

    op.create_index(
        "ix_reviews_ride_id",
        "reviews",
        ["ride_id"],
    )
    op.create_index(
        "ix_reviews_reviewer_id",
        "reviews",
        ["reviewer_id"],
    )
    op.create_index(
        "ix_reviews_reviewee_id",
        "reviews",
        ["reviewee_id"],
    )
    op.create_index(
        "ix_reviews_ride_reviewer_reviewee_unique",
        "reviews",
        ["ride_id", "reviewer_id", "reviewee_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Drop reviews table and indexes."""

    op.drop_index("ix_reviews_ride_reviewer_reviewee_unique", table_name="reviews")
    op.drop_index("ix_reviews_reviewee_id", table_name="reviews")
    op.drop_index("ix_reviews_reviewer_id", table_name="reviews")
    op.drop_index("ix_reviews_ride_id", table_name="reviews")
    op.drop_table("reviews")
