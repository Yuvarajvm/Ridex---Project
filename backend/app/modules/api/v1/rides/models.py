"""Ride persistence model for RIDEX."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.api.v1.bookings.models import Booking
    from app.modules.api.v1.users.models import User
    from app.modules.api.v1.vehicles.models import Vehicle


class Ride(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    A ride published by a driver.

    Authentication and booking ownership rules are intentionally kept
    outside this model and will be connected through the service layer.
    """

    __tablename__ = "rides"

    __table_args__ = (
        CheckConstraint(
            "length(trim(origin)) > 0",
            name="ck_rides_origin_nonempty",
        ),
        CheckConstraint(
            "length(trim(destination)) > 0",
            name="ck_rides_destination_nonempty",
        ),
        CheckConstraint(
            "origin <> destination",
            name="ck_rides_origin_destination_different",
        ),
        CheckConstraint(
            "departure_at > created_at",
            name="ck_rides_departure_after_creation",
        ),
        CheckConstraint(
            "available_seats BETWEEN 0 AND 8",
            name="ck_rides_available_seats",
        ),
        CheckConstraint(
            "price_per_seat >= 10",
            name="ck_rides_minimum_price",
        ),
        CheckConstraint(
            "status IN ('scheduled', 'in_progress', 'completed', 'cancelled')",
            name="ck_rides_status",
        ),
        Index("ix_rides_driver_id", "driver_id"),
        Index("ix_rides_vehicle_id", "vehicle_id"),
        Index("ix_rides_origin", "origin"),
        Index("ix_rides_destination", "destination"),
        Index("ix_rides_departure_at", "departure_at"),
        Index("ix_rides_status", "status"),
        Index(
            "ix_rides_marketplace_search",
            "origin",
            "destination",
            "departure_at",
        ),
    )

    driver_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    vehicle_id: Mapped[UUID] = mapped_column(
        ForeignKey("vehicles.id", ondelete="RESTRICT"),
        nullable=False,
    )

    origin: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    destination: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    departure_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    available_seats: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    price_per_seat: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="scheduled",
        server_default="scheduled",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    driver: Mapped["User"] = relationship(
        "User",
        back_populates="rides",
    )

    vehicle: Mapped["Vehicle"] = relationship(
        "Vehicle",
    )

    bookings: Mapped[list["Booking"]] = relationship(
        "Booking",
        back_populates="ride",
    )