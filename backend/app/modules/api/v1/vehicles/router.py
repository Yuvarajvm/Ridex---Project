"""HTTP routes for RIDEX vehicle management."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.vehicles.schemas import (
    VehicleCreate,
    VehicleListResponse,
    VehicleResponse,
    VehicleUpdate,
)
from app.modules.api.v1.vehicles.service import VehicleService


router = APIRouter(
    prefix="/vehicles",
    tags=["Vehicles"],
)


# Temporary development dependency.
#
# Authentication will replace this with the real authenticated-user
# dependency when the Auth module is implemented.
async def get_current_user_id() -> UUID:
    """
    Temporary authenticated-user placeholder.

    This MUST be replaced by the Auth module before vehicle endpoints
    are exposed beyond development.
    """

    raise NotImplementedError(
        "Authentication dependency has not been implemented yet."
    )


@router.post(
    "",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vehicle(
    payload: VehicleCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user_id: UUID = Depends(get_current_user_id),
) -> VehicleResponse:
    """Register a vehicle for the authenticated user."""

    service = VehicleService(session)

    vehicle = await service.create_vehicle(
        owner_id=current_user_id,
        payload=payload,
    )

    return VehicleResponse.model_validate(vehicle)


@router.get(
    "",
    response_model=VehicleListResponse,
)
async def list_my_vehicles(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
    current_user_id: UUID = Depends(get_current_user_id),
) -> VehicleListResponse:
    """List vehicles belonging to the authenticated user."""

    service = VehicleService(session)

    vehicles, total = await service.list_owner_vehicles(
        owner_id=current_user_id,
        page=page,
        page_size=page_size,
    )

    return VehicleListResponse(
        items=[
            VehicleResponse.model_validate(vehicle)
            for vehicle in vehicles
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{vehicle_id}",
    response_model=VehicleResponse,
)
async def get_vehicle(
    vehicle_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> VehicleResponse:
    """Retrieve an active vehicle by ID."""

    service = VehicleService(session)

    vehicle = await service.get_vehicle(vehicle_id)

    return VehicleResponse.model_validate(vehicle)


@router.patch(
    "/{vehicle_id}",
    response_model=VehicleResponse,
)
async def update_vehicle(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user_id: UUID = Depends(get_current_user_id),
) -> VehicleResponse:
    """Update a vehicle owned by the authenticated user."""

    service = VehicleService(session)

    vehicle = await service.update_vehicle(
        vehicle_id=vehicle_id,
        owner_id=current_user_id,
        payload=payload,
    )

    return VehicleResponse.model_validate(vehicle)


@router.delete(
    "/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_vehicle(
    vehicle_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user_id: UUID = Depends(get_current_user_id),
) -> None:
    """Soft-delete a vehicle owned by the authenticated user."""

    service = VehicleService(session)

    await service.delete_vehicle(
        vehicle_id=vehicle_id,
        owner_id=current_user_id,
    )