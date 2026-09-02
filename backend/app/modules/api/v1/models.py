"""Vehicle persistence model for driver-owned ride vehicles."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.api.v1.users.models import User


class Vehicle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Vehicle owned by a user and eligible for ride publication
    after verification.
    """

    __tablename__ = "vehicles"

    __table_args__ = (
        CheckConstraint(
            "vehicle_type IN ('car', 'bike', 'auto', 'van')",
            name="ck_vehicles_type",
        ),
        CheckConstraint(
            "length(trim(registration_number)) > 0",
            name="ck_vehicles_registration_nonempty",
        ),
        CheckConstraint(
            "registration_number = upper(trim(registration_number))",
            name="ck_vehicles_registration_normalized",
        ),
        CheckConstraint(
            "seat_capacity BETWEEN 1 AND 8",
            name="ck_vehicles_seat_capacity",
        ),
        CheckConstraint(
            "manufacture_year IS NULL OR manufacture_year >= 1990",
            name="ck_vehicles_manufacture_year",
        ),
        CheckConstraint(
            "verification_status IN "
            "('pending', 'verified', 'rejected', 'expired')",
            name="ck_vehicles_verification_status",
        ),
        CheckConstraint(
            "verification_status != 'verified' "
            "OR verified_at IS NOT NULL",
            name="ck_vehicles_verified_requires_timestamp",
        ),
        CheckConstraint(
            "verification_status != 'rejected' "
            "OR rejected_reason IS NOT NULL",
            name="ck_vehicles_rejected_requires_reason",
        ),
        CheckConstraint(
            "verification_status = 'rejected' "
            "OR rejected_reason IS NULL",
            name="ck_vehicles_rejected_reason_only_when_rejected",
        ),
        Index(
            "ix_vehicles_owner_id",
            "owner_id",
        ),
        Index(
            "ix_vehicles_registration_number_active_unique",
            "registration_number",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_vehicles_verification_status",
            "verification_status",
        ),
        Index(
            "ix_vehicles_is_active",
            "is_active",
        ),
        Index(
            "ix_vehicles_created_at",
            "created_at",
        ),
    )

    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    vehicle_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    make: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    color: Mapped[str | None] = mapped_column(
        String(60),
        nullable=True,
    )

    registration_number: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    registration_state: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    manufacture_year: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    seat_capacity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    verification_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    rejected_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    owner: Mapped[User] = relationship(
        back_populates="vehicles",
    )