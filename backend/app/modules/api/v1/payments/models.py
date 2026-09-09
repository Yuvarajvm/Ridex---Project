"""Payment persistence model for RIDEX."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.api.v1.bookings.models import Booking
    from app.modules.api.v1.users.models import User


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Payment transaction record for a ride booking.
    """

    __tablename__ = "payments"

    __table_args__ = (
        CheckConstraint(
            "amount >= 0",
            name="ck_payments_amount_nonnegative",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')",
            name="ck_payments_status",
        ),
        Index("ix_payments_booking_id", "booking_id"),
        Index("ix_payments_payer_id", "payer_id"),
        Index("ix_payments_status", "status"),
    )

    booking_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="RESTRICT"),
        nullable=False,
    )

    payer_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="INR",
        server_default="INR",
    )

    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="mock",
        server_default="mock",
    )

    provider_payment_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    provider_order_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    error_message: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    booking: Mapped["Booking"] = relationship(
        "Booking",
        back_populates="payment",
    )

    payer: Mapped["User"] = relationship(
        "User",
        back_populates="payments",
    )
