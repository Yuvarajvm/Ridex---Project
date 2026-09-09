"""Review and rating persistence model for RIDEX."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.api.v1.rides.models import Ride
    from app.modules.api.v1.users.models import User


class Review(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Verified review and 1-5 star rating submitted between co-passengers / drivers.
    """

    __tablename__ = "reviews"

    __table_args__ = (
        CheckConstraint(
            "rating BETWEEN 1 AND 5",
            name="ck_reviews_rating_range",
        ),
        CheckConstraint(
            "reviewer_id != reviewee_id",
            name="ck_reviews_no_self_review",
        ),
        Index("ix_reviews_ride_id", "ride_id"),
        Index("ix_reviews_reviewer_id", "reviewer_id"),
        Index("ix_reviews_reviewee_id", "reviewee_id"),
        Index(
            "ix_reviews_ride_reviewer_reviewee_unique",
            "ride_id",
            "reviewer_id",
            "reviewee_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    ride_id: Mapped[UUID] = mapped_column(
        ForeignKey("rides.id", ondelete="RESTRICT"),
        nullable=False,
    )

    reviewer_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    reviewee_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    comment: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    ride: Mapped["Ride"] = relationship(
        "Ride",
    )

    reviewer: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reviewer_id],
    )

    reviewee: Mapped["User"] = relationship(
        "User",
        foreign_keys=[reviewee_id],
    )
