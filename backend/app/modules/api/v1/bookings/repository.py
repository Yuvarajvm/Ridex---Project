"""Database access layer for RIDEX bookings."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.api.v1.bookings.models import Booking
from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.users.models import User


class BookingRepository:
    """Encapsulates database operations for bookings."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, booking: Booking) -> Booking:
        """Persist a new booking."""
        self.session.add(booking)
        await self.session.flush()
        await self.session.refresh(booking)
        return booking

    async def get_by_id(self, booking_id: UUID) -> Booking | None:
        """Fetch booking by ID with eagerly loaded relationships."""
        statement = (
            select(Booking)
            .options(
                joinedload(Booking.ride)
                .joinedload(Ride.driver)
                .joinedload(User.profile),
                joinedload(Booking.ride).joinedload(Ride.vehicle),
                joinedload(Booking.rider).joinedload(User.profile),
            )
            .where(
                Booking.id == booking_id,
                Booking.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_active_booking_by_rider_and_ride(
        self,
        rider_id: UUID,
        ride_id: UUID,
    ) -> Booking | None:
        """Check for existing active booking for rider on a ride."""
        statement = select(Booking).where(
            Booking.rider_id == rider_id,
            Booking.ride_id == ride_id,
            Booking.status.in_(["requested", "confirmed"]),
            Booking.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_booking_for_rider_and_ride(
        self,
        rider_id: UUID,
        ride_id: UUID,
    ) -> Booking | None:
        """Fetch booking for rider on a ride regardless of status."""
        statement = select(Booking).where(
            Booking.rider_id == rider_id,
            Booking.ride_id == ride_id,
            Booking.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def list_by_rider(
        self,
        rider_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Booking], int]:
        """Return paginated bookings for a rider."""
        offset = (page - 1) * page_size

        statement = (
            select(Booking)
            .options(
                joinedload(Booking.ride)
                .joinedload(Ride.driver)
                .joinedload(User.profile),
                joinedload(Booking.ride).joinedload(Ride.vehicle),
                joinedload(Booking.rider).joinedload(User.profile),
            )
            .where(
                Booking.rider_id == rider_id,
                Booking.deleted_at.is_(None),
            )
            .order_by(Booking.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        count_statement = select(func.count(Booking.id)).where(
            Booking.rider_id == rider_id,
            Booking.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)
        total_result = await self.session.execute(count_statement)

        bookings = list(result.scalars().unique().all())
        total = total_result.scalar_one()

        return bookings, total

    async def list_by_ride(
        self,
        ride_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Booking], int]:
        """Return paginated bookings for a specific ride (for driver view)."""
        offset = (page - 1) * page_size

        statement = (
            select(Booking)
            .options(
                joinedload(Booking.ride)
                .joinedload(Ride.driver)
                .joinedload(User.profile),
                joinedload(Booking.ride).joinedload(Ride.vehicle),
                joinedload(Booking.rider).joinedload(User.profile),
            )
            .where(
                Booking.ride_id == ride_id,
                Booking.deleted_at.is_(None),
            )
            .order_by(Booking.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        count_statement = select(func.count(Booking.id)).where(
            Booking.ride_id == ride_id,
            Booking.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)
        total_result = await self.session.execute(count_statement)

        bookings = list(result.scalars().unique().all())
        total = total_result.scalar_one()

        return bookings, total
