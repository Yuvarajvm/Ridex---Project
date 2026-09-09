"""SQLAlchemy models for Safety and Incident Reporting."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class IncidentReport(Base):
    """Incident/safety report submitted by riders or drivers."""

    __tablename__ = "incident_reports"

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'investigating', 'resolved', 'dismissed')",
            name="ck_incident_reports_status",
        ),
        Index("ix_incident_reports_reporter_id", "reporter_id"),
        Index("ix_incident_reports_reported_user_id", "reported_user_id"),
        Index("ix_incident_reports_ride_id", "ride_id"),
        Index("ix_incident_reports_status", "status"),
        Index("ix_incident_reports_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    reported_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    ride_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rides.id", ondelete="SET NULL"),
        nullable=True,
    )

    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    admin_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    reporter: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[reporter_id],
        lazy="joined",
    )

    reported_user: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[reported_user_id],
        lazy="joined",
    )

    ride: Mapped["Ride | None"] = relationship(  # type: ignore[name-defined]
        "Ride",
        foreign_keys=[ride_id],
        lazy="joined",
    )
