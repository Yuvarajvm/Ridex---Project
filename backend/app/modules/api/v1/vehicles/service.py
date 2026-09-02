"""Business logic for RIDEX vehicle operations."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.vehicles.models import Vehicle
from app.modules.api.v1.vehicles.repository import VehicleRepository
from app.modules.api.v1.vehicles.schemas import (
    VehicleCreate,
    VehicleUpdate,
)


class VehicleService:
    """Business service responsible for vehicle lifecycle operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = VehicleRepository(session)
        self.session = session

    async def create_vehicle(
        self,
        owner_id: UUID,
        payload: VehicleCreate,
    ) -> Vehicle:
        """Register a new vehicle for a user."""

        existing_vehicle = await self.repository.get_by_registration_number(
            payload.registration_number
        )

        if existing_vehicle is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A vehicle with this registration number already exists.",
            )

        vehicle = Vehicle(
            owner_id=owner_id,
            vehicle_type=payload.vehicle_type,
            make=payload.make,
            model=payload.model,
            color=payload.color,
            registration_number=payload.registration_number,
            registration_state=payload.registration_state,
            manufacture_year=payload.manufacture_year,
            seat_capacity=payload.seat_capacity,
        )

        try:
            await self.repository.create(vehicle)
            await self.session.commit()

        except IntegrityError:
            await self.session.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle could not be created because of a data conflict.",
            ) from None

        return vehicle

    async def get_vehicle(
        self,
        vehicle_id: UUID,
    ) -> Vehicle:
        """Return a vehicle or raise 404."""

        vehicle = await self.repository.get_by_id(vehicle_id)

        if vehicle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )

        return vehicle

    async def list_owner_vehicles(
        self,
        owner_id: UUID,
        *,
        page: int,
        page_size: int,
    ) -> tuple[list[Vehicle], int]:
        """Return the owner's active vehicles."""

        return await self.repository.list_by_owner(
            owner_id,
            page=page,
            page_size=page_size,
        )

    async def update_vehicle(
        self,
        vehicle_id: UUID,
        owner_id: UUID,
        payload: VehicleUpdate,
    ) -> Vehicle:
        """Update a vehicle owned by the requesting user."""

        vehicle = await self.get_vehicle(vehicle_id)

        if vehicle.owner_id != owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this vehicle.",
            )

        updates = payload.model_dump(exclude_unset=True)

        if "registration_number" in updates:
            registration_number = updates["registration_number"]

            if registration_number != vehicle.registration_number:
                existing_vehicle = (
                    await self.repository.get_by_registration_number(
                        registration_number
                    )
                )

                if existing_vehicle is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            "A vehicle with this registration number "
                            "already exists."
                        ),
                    )

        for field_name, value in updates.items():
            setattr(vehicle, field_name, value)

        try:
            await self.session.commit()
            await self.session.refresh(vehicle)

        except IntegrityError:
            await self.session.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle could not be updated because of a data conflict.",
            ) from None

        return vehicle

    async def delete_vehicle(
        self,
        vehicle_id: UUID,
        owner_id: UUID,
    ) -> None:
        """Soft-delete a vehicle owned by the requesting user."""

        vehicle = await self.get_vehicle(vehicle_id)

        if vehicle.owner_id != owner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this vehicle.",
            )

        await self.repository.delete(vehicle)

        await self.session.commit()