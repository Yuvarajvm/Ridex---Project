"""Business logic for RIDEX bookings with transactional concurrency."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
)
from app.modules.api.v1.bookings.models import Booking
from app.modules.api.v1.bookings.repository import BookingRepository
from app.modules.api.v1.bookings.schemas import BookingCreate
from app.modules.api.v1.notifications.models import Notification
from app.modules.api.v1.rides.models import Ride


VALID_BOOKING_TRANSITIONS: dict[str, set[str]] = {
    "requested": {"confirmed", "rejected", "cancelled"},
    "confirmed": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
    "rejected": set(),
}


class BookingService:
    """Service managing booking lifecycle with row-level locks on rides."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = BookingRepository(session)

    async def create_booking(
        self,
        rider_id: UUID,
        payload: BookingCreate,
    ) -> Booking:
        """
        Create a booking with row-level lock (FOR UPDATE) on Ride to prevent race conditions.
        """
        # 1. Acquire pessimistic lock on the target ride
        statement = (
            select(Ride)
            .where(
                Ride.id == payload.ride_id,
                Ride.deleted_at.is_(None),
            )
            .with_for_update()
        )
        result = await self.session.execute(statement)
        ride = result.scalar_one_or_none()

        if ride is None:
            raise NotFoundError("Ride not found.")

        if ride.driver_id == rider_id:
            raise ConflictError("Drivers cannot book seats on their own ride.")

        if ride.status != "scheduled":
            raise ConflictError(f"Cannot book a ride that is {ride.status}.")

        now = datetime.now(timezone.utc)
        if ride.departure_at <= now:
            raise ConflictError("Cannot book a ride that has already departed.")

        # 2. Check for duplicate active booking
        existing = await self.repository.get_active_booking_by_rider_and_ride(
            rider_id=rider_id,
            ride_id=payload.ride_id,
        )
        if existing is not None:
            raise ConflictError("You already have an active booking for this ride.")

        # 3. Check seat capacity
        if ride.available_seats < payload.seats_booked:
            raise ConflictError(
                f"Requested {payload.seats_booked} seat(s), but only "
                f"{ride.available_seats} seat(s) remain available."
            )

        # 4. Atomically deduct available seats and create booking
        ride.available_seats -= payload.seats_booked
        total_fare = Decimal(str(ride.price_per_seat)) * Decimal(str(payload.seats_booked))

        booking = Booking(
            ride_id=ride.id,
            rider_id=rider_id,
            seats_booked=payload.seats_booked,
            total_fare=total_fare,
            status="confirmed",
        )

        created = await self.repository.create(booking)

        # Notify driver about the new booking
        driver_notif = Notification(
            user_id=ride.driver_id,
            type="booking_created",
            title="New Seat Reservation",
            message=f"{payload.seats_booked} seat(s) reserved for your trip {ride.origin} → {ride.destination}.",
            data={"ride_id": str(ride.id), "booking_id": str(booking.id)},
            is_read=False,
        )
        self.session.add(driver_notif)

        await self.session.commit()

        # 5. Reload booking with full eager relationships for response
        loaded = await self.repository.get_by_id(created.id)
        return loaded or created

    async def cancel_booking(
        self,
        booking_id: UUID,
        user_id: UUID,
        reason: str | None = None,
    ) -> Booking:
        """
        Cancel booking, releasing reserved seats back to the ride under a lock.
        """
        booking = await self.repository.get_by_id(booking_id)
        if booking is None:
            raise NotFoundError("Booking not found.")

        # Lock the associated ride
        statement = (
            select(Ride)
            .where(
                Ride.id == booking.ride_id,
                Ride.deleted_at.is_(None),
            )
            .with_for_update()
        )
        result = await self.session.execute(statement)
        ride = result.scalar_one_or_none()

        if ride is None:
            raise NotFoundError("Associated ride not found.")

        is_rider = booking.rider_id == user_id
        is_driver = ride.driver_id == user_id

        if not (is_rider or is_driver):
            raise AuthorizationError("You are not authorized to cancel this booking.")

        if booking.status in {"cancelled", "completed", "rejected"}:
            raise ConflictError(f"Booking is already {booking.status}.")

        # Restore seats if booking was holding seats
        if booking.status in {"requested", "confirmed"}:
            ride.available_seats += booking.seats_booked

        booking.status = "cancelled"
        booking.cancellation_reason = (
            reason.strip()
            if reason
            else ("Cancelled by rider" if is_rider else "Cancelled by driver")
        )

        # Notify counterparty
        recipient_id = ride.driver_id if is_rider else booking.rider_id
        notif_msg = (
            f"Passenger cancelled their reservation for trip {ride.origin} → {ride.destination}."
            if is_rider
            else f"Driver cancelled your reservation for trip {ride.origin} → {ride.destination}."
        )
        cancel_notif = Notification(
            user_id=recipient_id,
            type="booking_cancelled",
            title="Booking Cancelled",
            message=notif_msg,
            data={"ride_id": str(ride.id), "booking_id": str(booking.id)},
            is_read=False,
        )
        self.session.add(cancel_notif)

        await self.session.commit()
        loaded = await self.repository.get_by_id(booking_id)
        return loaded or booking

    async def transition_status(
        self,
        booking_id: UUID,
        new_status: str,
        actor_id: UUID,
        reason: str | None = None,
    ) -> Booking:
        """
        Transition booking to a new state enforcing the valid state machine.
        """
        booking = await self.repository.get_by_id(booking_id)
        if booking is None:
            raise NotFoundError("Booking not found.")

        # Lock the associated ride
        statement = (
            select(Ride)
            .where(
                Ride.id == booking.ride_id,
                Ride.deleted_at.is_(None),
            )
            .with_for_update()
        )
        result = await self.session.execute(statement)
        ride = result.scalar_one_or_none()
        if ride is None:
            raise NotFoundError("Associated ride not found.")

        is_rider = booking.rider_id == actor_id
        is_driver = ride.driver_id == actor_id

        if not (is_rider or is_driver):
            raise AuthorizationError("You are not authorized to modify this booking state.")

        allowed = VALID_BOOKING_TRANSITIONS.get(booking.status, set())
        if new_status not in allowed:
            raise ConflictError(
                f"Invalid booking transition: cannot change status from '{booking.status}' to '{new_status}'."
            )

        # Release seats if moving from a held state to a terminal release state
        if booking.status in {"requested", "confirmed"} and new_status in {"cancelled", "rejected"}:
            ride.available_seats += booking.seats_booked

        booking.status = new_status
        if reason:
            booking.cancellation_reason = reason.strip()

        await self.session.commit()
        loaded = await self.repository.get_by_id(booking_id)
        return loaded or booking

    async def complete_booking(
        self,
        booking_id: UUID,
        actor_id: UUID,
    ) -> Booking:
        """Mark a confirmed booking as completed."""
        return await self.transition_status(
            booking_id=booking_id,
            new_status="completed",
            actor_id=actor_id,
        )

    async def get_booking(
        self,
        booking_id: UUID,
        user_id: UUID,
    ) -> Booking:
        """Retrieve booking if user is passenger, driver, or admin."""
        booking = await self.repository.get_by_id(booking_id)
        if booking is None:
            raise NotFoundError("Booking not found.")

        if booking.rider_id != user_id and booking.ride.driver_id != user_id:
            raise AuthorizationError("You do not have access to view this booking.")

        return booking

    async def list_my_bookings(
        self,
        rider_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Booking], int]:
        """List bookings made by the current user."""
        return await self.repository.list_by_rider(
            rider_id,
            page=page,
            page_size=page_size,
        )

    async def list_ride_bookings(
        self,
        ride_id: UUID,
        driver_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Booking], int]:
        """List bookings for a ride, restricted to the ride's driver."""
        ride_statement = select(Ride).where(
            Ride.id == ride_id,
            Ride.deleted_at.is_(None),
        )
        ride_result = await self.session.execute(ride_statement)
        ride = ride_result.scalar_one_or_none()

        if ride is None:
            raise NotFoundError("Ride not found.")

        if ride.driver_id != driver_id:
            raise AuthorizationError("Only the ride driver can view passenger bookings.")

        return await self.repository.list_by_ride(
            ride_id,
            page=page,
            page_size=page_size,
        )
