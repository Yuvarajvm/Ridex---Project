"""SQLAlchemy model for trip messaging between ride co-travelers."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TripMessage(Base):
    """In-trip group message sent between driver and passengers of a ride."""

    __tablename__ = "trip_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    ride_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rides.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    ride: Mapped["Ride"] = relationship("Ride", foreign_keys=[ride_id], lazy="raise")  # type: ignore[name-defined]
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id], lazy="joined")  # type: ignore[name-defined]

    __table_args__ = (
        Index("ix_trip_messages_ride_id", "ride_id"),
        Index("ix_trip_messages_created_at", "created_at"),
    )
