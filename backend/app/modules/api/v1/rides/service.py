"""Business logic for rides."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import AuthorizationError, ConflictError, NotFoundError
from app.modules.api.v1.bookings.models import Booking
from app.modules.api.v1.notifications.models import Notification
from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.rides.repository import RideRepository
from app.modules.api.v1.rides.schemas import RideCreate
from app.modules.api.v1.users.models import User
from app.modules.api.v1.vehicles.repository import VehicleRepository


class RideService:
    """Application service for ride operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = RideRepository(session)
        self.vehicle_repository = VehicleRepository(session)

    async def create_ride(
        self,
        driver_id: UUID,
        payload: RideCreate,
    ) -> Ride:
        now = datetime.now(timezone.utc)

        if payload.departure_at <= now:
            raise ValueError("Departure time must be in the future.")

        origin = payload.origin.strip()
        destination = payload.destination.strip()

        if not origin:
            raise ValueError("Origin is required.")

        if not destination:
            raise ValueError("Destination is required.")

        if origin.casefold() == destination.casefold():
            raise ValueError("Origin and destination must be different.")

        vehicle = await self.vehicle_repository.get_by_id(payload.vehicle_id)
        if vehicle is None:
            raise NotFoundError("Vehicle not found.")

        if vehicle.owner_id != driver_id:
            raise AuthorizationError("You do not own this vehicle.")

        if payload.available_seats > vehicle.seat_capacity:
            raise ValueError(
                f"Available seats ({payload.available_seats}) cannot exceed "
                f"vehicle capacity ({vehicle.seat_capacity})."
            )

        # Women-only ride: verify the driver has a female profile
        if payload.is_women_only:
            driver_stmt = (
                select(User)
                .options(joinedload(User.profile))
                .where(User.id == driver_id)
            )
            driver_result = await self.session.execute(driver_stmt)
            driver_user = driver_result.scalar_one_or_none()
            if (
                driver_user is None
                or driver_user.profile is None
                or driver_user.profile.gender != "female"
            ):
                raise ConflictError(
                    "Only verified female drivers can publish women-only rides. "
                    "Please update your profile gender first."
                )

        ride = Ride(
            driver_id=driver_id,
            vehicle_id=payload.vehicle_id,
            origin=origin,
            destination=destination,
            departure_at=payload.departure_at,
            available_seats=payload.available_seats,
            price_per_seat=payload.price_per_seat,
            is_women_only=payload.is_women_only,
            notes=payload.notes.strip() if payload.notes else None,
        )

        created_ride = await self.repository.create(ride)
        loaded_ride = await self.repository.get_by_id(created_ride.id)
        return loaded_ride or created_ride

    async def get_ride(self, ride_id: UUID) -> Ride | None:
        return await self.repository.get_by_id(ride_id)

    async def search_rides(
        self,
        origin: str | None,
        destination: str | None,
        departure_from: datetime | None,
        departure_to: datetime | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Ride], int]:
        offset = (page - 1) * page_size

        if departure_from and departure_to and departure_from > departure_to:
            raise ValueError("Departure start must be before departure end.")

        total = await self.repository.count_search_results(
            origin=origin.strip() if origin else None,
            destination=destination.strip() if destination else None,
            departure_from=departure_from,
            departure_to=departure_to,
        )

        rides = await self.repository.search(
            origin=origin.strip() if origin else None,
            destination=destination.strip() if destination else None,
            departure_from=departure_from,
            departure_to=departure_to,
            offset=offset,
            limit=page_size,
        )

        return rides, total

    async def search_locations(
        self,
        query: str | None,
        limit: int = 8,
    ) -> list[str]:
        normalized_query = query.strip() if query else None

        if limit < 1:
            return []

        return await self.repository.search_locations(
            query=normalized_query,
            limit=min(limit, 20),
        )

    async def get_available_dates(
        self,
        origin: str,
        destination: str,
        month_start: datetime,
        month_end: datetime,
    ) -> list[datetime]:
        normalized_origin = origin.strip()
        normalized_destination = destination.strip()

        if not normalized_origin or not normalized_destination:
            return []

        if normalized_origin.casefold() == normalized_destination.casefold():
            return []

        if month_start >= month_end:
            return []

        return await self.repository.get_available_dates(
            origin=normalized_origin,
            destination=normalized_destination,
            month_start=month_start,
            month_end=month_end,
        )

    async def update_ride_status(
        self,
        ride_id: UUID,
        driver_id: UUID,
        new_status: str,
        reason: str | None = None,
    ) -> Ride:
        """Update ride status following strict state transition rules."""
        ride = await self.repository.get_by_id(ride_id)
        if ride is None:
            raise NotFoundError("Ride not found.")

        if ride.driver_id != driver_id:
            raise AuthorizationError("Only the driver can update ride status.")

        valid_transitions: dict[str, set[str]] = {
            "scheduled": {"in_progress", "completed", "cancelled"},
            "in_progress": {"completed", "cancelled"},
            "completed": set(),
            "cancelled": set(),
        }

        if new_status not in valid_transitions.get(ride.status, set()):
            raise ConflictError(
                f"Cannot transition ride from '{ride.status}' to '{new_status}'."
            )

        ride.status = new_status

        if new_status == "cancelled":
            # Cancel all active bookings and notify riders
            booking_stmt = (
                select(Booking)
                .where(
                    Booking.ride_id == ride.id,
                    Booking.status.in_(["requested", "confirmed"]),
                    Booking.deleted_at.is_(None),
                )
            )
            bookings_res = await self.session.execute(booking_stmt)
            active_bookings = list(bookings_res.scalars().all())

            cancel_reason_text = (
                reason.strip() if reason and reason.strip() else "Ride was cancelled by the driver"
            )
            for b in active_bookings:
                b.status = "cancelled"
                b.cancellation_reason = cancel_reason_text
                ride.available_seats += b.seats_booked

                # Dispatch notification to passenger
                notif = Notification(
                    user_id=b.rider_id,
                    type="booking_cancelled",
                    title="Ride Cancelled by Driver",
                    message=f"The driver has cancelled the trip from {ride.origin} to {ride.destination}. Reason: {cancel_reason_text}",
                    data={"ride_id": str(ride.id), "booking_id": str(b.id)},
                    is_read=False,
                )
                self.session.add(notif)

        await self.session.commit()
        await self.session.refresh(ride)
        loaded = await self.repository.get_by_id(ride.id)
        return loaded or ride

    async def cancel_ride_as_driver(
        self,
        ride_id: UUID,
        driver_id: UUID,
        reason: str | None = None,
    ) -> Ride:
        """Cancel a ride as the host driver, cancelling active passenger reservations."""
        return await self.update_ride_status(
            ride_id=ride_id,
            driver_id=driver_id,
            new_status="cancelled",
            reason=reason,
        )

    async def list_my_offered_rides(
        self,
        driver_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Ride], int]:
        """Return paginated list of rides offered/published by the authenticated driver."""
        return await self.repository.list_by_driver(
            driver_id=driver_id,
            page=page,
            page_size=page_size,
        )