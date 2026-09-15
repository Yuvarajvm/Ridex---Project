"""Database access layer for rides."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.users.models import User


class RideRepository:
    """Repository for ride persistence and marketplace queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, ride: Ride) -> Ride:
        self.session.add(ride)
        await self.session.flush()
        await self.session.refresh(ride)
        return ride

    async def get_by_id(self, ride_id: UUID) -> Ride | None:
        result = await self.session.execute(
            select(Ride)
            .options(
                joinedload(Ride.driver).joinedload(User.profile),
                joinedload(Ride.vehicle),
            )
            .where(
                Ride.id == ride_id,
                Ride.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def count_search_results(
        self,
        origin: str | None,
        destination: str | None,
        departure_from: datetime | None,
        departure_to: datetime | None,
    ) -> int:
        query = select(func.count(Ride.id)).where(
            Ride.deleted_at.is_(None),
            Ride.status == "scheduled",
        )

        if origin:
            query = query.where(Ride.origin.ilike(f"%{origin.strip()}%"))

        if destination:
            query = query.where(
                Ride.destination.ilike(f"%{destination.strip()}%")
            )

        if departure_from:
            query = query.where(Ride.departure_at >= departure_from)

        if departure_to:
            query = query.where(Ride.departure_at <= departure_to)

        result = await self.session.execute(query)
        return result.scalar_one()

    async def search(
        self,
        origin: str | None,
        destination: str | None,
        departure_from: datetime | None,
        departure_to: datetime | None,
        offset: int,
        limit: int,
    ) -> list[Ride]:
        query = (
            select(Ride)
            .options(
                joinedload(Ride.driver).joinedload(User.profile),
                joinedload(Ride.vehicle),
            )
            .where(
                Ride.deleted_at.is_(None),
                Ride.status == "scheduled",
            )
            .order_by(Ride.departure_at.asc())
            .offset(offset)
            .limit(limit)
        )

        if origin:
            query = query.where(Ride.origin.ilike(f"%{origin.strip()}%"))

        if destination:
            query = query.where(
                Ride.destination.ilike(f"%{destination.strip()}%")
            )

        if departure_from:
            query = query.where(Ride.departure_at >= departure_from)

        if departure_to:
            query = query.where(Ride.departure_at <= departure_to)

        result = await self.session.execute(query)
        return list(result.scalars().unique().all())

    async def search_locations(
        self,
        query: str | None,
        limit: int = 8,
    ) -> list[str]:
        origin_query = select(Ride.origin).where(
            Ride.deleted_at.is_(None),
            Ride.status == "scheduled",
        )

        destination_query = select(Ride.destination).where(
            Ride.deleted_at.is_(None),
            Ride.status == "scheduled",
        )

        if query:
            pattern = f"%{query.strip()}%"
            origin_query = origin_query.where(
                Ride.origin.ilike(pattern)
            )
            destination_query = destination_query.where(
                Ride.destination.ilike(pattern)
            )

        location_query = (
            origin_query
            .union(destination_query)
            .order_by("origin")
            .limit(limit)
        )

        result = await self.session.execute(location_query)

        return list(result.scalars().all())

    async def get_available_dates(
        self,
        origin: str,
        destination: str,
        month_start: datetime,
        month_end: datetime,
    ) -> list[datetime]:
        query = (
            select(Ride.departure_at)
            .where(
                Ride.deleted_at.is_(None),
                Ride.status == "scheduled",
                Ride.origin.ilike(origin.strip()),
                Ride.destination.ilike(destination.strip()),
                Ride.departure_at >= month_start,
                Ride.departure_at < month_end,
            )
            .order_by(Ride.departure_at.asc())
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def list_by_driver(
        self,
        driver_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Ride], int]:
        """Return paginated list of rides offered by a specific driver, newest first."""
        offset = (page - 1) * page_size
        query = (
            select(Ride)
            .options(
                joinedload(Ride.driver).joinedload(User.profile),
                joinedload(Ride.vehicle),
            )
            .where(
                Ride.driver_id == driver_id,
                Ride.deleted_at.is_(None),
            )
            .order_by(Ride.departure_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        count_query = (
            select(func.count(Ride.id))
            .where(
                Ride.driver_id == driver_id,
                Ride.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(query)
        count_result = await self.session.execute(count_query)
        return list(result.scalars().unique().all()), count_result.scalar_one()