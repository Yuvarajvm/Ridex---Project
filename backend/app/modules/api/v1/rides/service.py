"""Business logic for rides."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, ConflictError, NotFoundError
from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.rides.repository import RideRepository
from app.modules.api.v1.rides.schemas import RideCreate
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

        ride = Ride(
            driver_id=driver_id,
            vehicle_id=payload.vehicle_id,
            origin=origin,
            destination=destination,
            departure_at=payload.departure_at,
            available_seats=payload.available_seats,
            price_per_seat=payload.price_per_seat,
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
        await self.session.commit()
        await self.session.refresh(ride)
        loaded = await self.repository.get_by_id(ride.id)
        return loaded or ride