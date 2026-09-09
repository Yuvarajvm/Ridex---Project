"""Update ck_rides_available_seats to allow 0 available seats.

Revision ID: 20260909_0008
Revises: 20260909_0007
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260909_0008"
down_revision: str | Sequence[str] | None = "20260909_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Drop old constraint that required >= 1 seats and allow 0 seats for fully booked rides."""
    op.drop_constraint("ck_rides_available_seats", "rides", type_="check")
    op.create_check_constraint(
        "ck_rides_available_seats",
        "rides",
        "available_seats BETWEEN 0 AND 8",
    )


def downgrade() -> None:
    """Revert available_seats check constraint back to BETWEEN 1 AND 8."""
    op.drop_constraint("ck_rides_available_seats", "rides", type_="check")
    op.create_check_constraint(
        "ck_rides_available_seats",
        "rides",
        "available_seats BETWEEN 1 AND 8",
    )
