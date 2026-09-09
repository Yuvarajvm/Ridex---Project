"""Booking persistence model for RIDEX."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.api.v1.payments.models import Payment
    from app.modules.api.v1.rides.models import Ride
    from app.modules.api.v1.users.models import User


class Booking(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Booking representation linking a passenger (rider) to a scheduled ride.
    """

    __tablename__ = "bookings"

    __table_args__ = (
        CheckConstraint(
            "seats_booked BETWEEN 1 AND 8",
            name="ck_bookings_seats_booked",
        ),
        CheckConstraint(
            "total_fare >= 0",
            name="ck_bookings_total_fare_nonnegative",
        ),
        CheckConstraint(
            "status IN ('requested', 'confirmed', 'rejected', 'cancelled', 'completed')",
            name="ck_bookings_status",
        ),
        Index("ix_bookings_ride_id", "ride_id"),
        Index("ix_bookings_rider_id", "rider_id"),
        Index("ix_bookings_status", "status"),
        Index("ix_bookings_ride_rider", "ride_id", "rider_id"),
    )

    ride_id: Mapped[UUID] = mapped_column(
        ForeignKey("rides.id", ondelete="RESTRICT"),
        nullable=False,
    )

    rider_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    seats_booked: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    total_fare: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="confirmed",
        server_default="confirmed",
    )

    cancellation_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    ride: Mapped["Ride"] = relationship(
        "Ride",
        back_populates="bookings",
    )

    rider: Mapped["User"] = relationship(
        "User",
        back_populates="bookings",
    )

    payment: Mapped["Payment | None"] = relationship(
        "Payment",
        back_populates="booking",
        uselist=False,
    )
