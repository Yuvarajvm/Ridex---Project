"""Business logic for rides."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.rides.repository import RideRepository
from app.modules.api.v1.rides.schemas import RideCreate


class RideService:
    """Application service for ride operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = RideRepository(session)

    async def create_ride(
        self,
        driver_id: UUID,
        payload: RideCreate,
    ) -> Ride:
        now = datetime.now(timezone.utc)

        if payload.departure_at <= now:
            raise ValueError("Departure time must be in the future.")

        ride = Ride(
            driver_id=driver_id,
            vehicle_id=payload.vehicle_id,
            origin=payload.origin,
            destination=payload.destination,
            departure_at=payload.departure_at,
            available_seats=payload.available_seats,
            price_per_seat=payload.price_per_seat,
            notes=payload.notes,
        )

        return await self.repository.create(ride)

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

        total = await self.repository.count_search_results(
            origin=origin,
            destination=destination,
            departure_from=departure_from,
            departure_to=departure_to,
        )

        rides = await self.repository.search(
            origin=origin,
            destination=destination,
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
        return await self.repository.search_locations(
            query=query,
            limit=limit,
        )

    async def get_available_dates(
        self,
        origin: str,
        destination: str,
        month_start: datetime,
        month_end: datetime,
    ) -> list[datetime]:
        return await self.repository.get_available_dates(
            origin=origin,
            destination=destination,
            month_start=month_start,
            month_end=month_end,
        )