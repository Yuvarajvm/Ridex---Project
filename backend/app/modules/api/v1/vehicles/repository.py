"""Database access layer for RIDEX vehicles."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.vehicles.models import Vehicle


class VehicleRepository:
    """Encapsulates database operations for vehicles."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(
        self,
        vehicle_id: UUID,
    ) -> Vehicle | None:
        """Return an active vehicle by ID."""

        statement = select(Vehicle).where(
            Vehicle.id == vehicle_id,
            Vehicle.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)

        return result.scalar_one_or_none()

    async def get_by_registration_number(
        self,
        registration_number: str,
    ) -> Vehicle | None:
        """Return an active vehicle by registration number."""

        statement = select(Vehicle).where(
            Vehicle.registration_number == registration_number,
            Vehicle.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)

        return result.scalar_one_or_none()

    async def list_by_owner(
        self,
        owner_id: UUID,
        *,
        page: int,
        page_size: int,
    ) -> tuple[list[Vehicle], int]:
        """Return paginated active vehicles belonging to an owner."""

        offset = (page - 1) * page_size

        statement = (
            select(Vehicle)
            .where(
                Vehicle.owner_id == owner_id,
                Vehicle.deleted_at.is_(None),
            )
            .order_by(Vehicle.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        result = await self.session.execute(statement)

        vehicles = list(result.scalars().all())

        count_statement = select(func.count(Vehicle.id)).where(
            Vehicle.owner_id == owner_id,
            Vehicle.deleted_at.is_(None),
        )

        total_result = await self.session.execute(count_statement)

        total = total_result.scalar_one()

        return vehicles, total

    async def create(self, vehicle: Vehicle) -> Vehicle:
        """Persist a new vehicle."""

        self.session.add(vehicle)

        await self.session.flush()

        await self.session.refresh(vehicle)

        return vehicle

    async def delete(
        self,
        vehicle: Vehicle,
    ) -> None:
        """Soft-delete a vehicle."""

        vehicle.deleted_at = func.now()
        vehicle.is_active = False

        await self.session.flush()