"""HTTP routes for RIDEX vehicle management."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.users.models import User
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


@router.post(
    "",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new vehicle for the authenticated user",
)
async def create_vehicle(
    payload: VehicleCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VehicleResponse:
    """Register a vehicle for the authenticated user."""
    service = VehicleService(session)
    vehicle = await service.create_vehicle(
        owner_id=current_user.id,
        payload=payload,
    )
    return VehicleResponse.model_validate(vehicle)


@router.get(
    "",
    response_model=VehicleListResponse,
    summary="List vehicles belonging to the authenticated user",
)
async def list_my_vehicles(
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VehicleListResponse:
    """List vehicles belonging to the authenticated user."""
    service = VehicleService(session)
    vehicles, total = await service.list_owner_vehicles(
        owner_id=current_user.id,
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
    summary="Retrieve a vehicle by ID",
)
async def get_vehicle(
    vehicle_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VehicleResponse:
    """Retrieve an active vehicle by ID."""
    service = VehicleService(session)
    vehicle = await service.get_vehicle(vehicle_id)
    return VehicleResponse.model_validate(vehicle)


@router.patch(
    "/{vehicle_id}",
    response_model=VehicleResponse,
    summary="Update an owned vehicle",
)
async def update_vehicle(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VehicleResponse:
    """Update a vehicle owned by the authenticated user."""
    service = VehicleService(session)
    vehicle = await service.update_vehicle(
        vehicle_id=vehicle_id,
        owner_id=current_user.id,
        payload=payload,
    )
    return VehicleResponse.model_validate(vehicle)


@router.delete(
    "/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete an owned vehicle",
)
async def delete_vehicle(
    vehicle_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft-delete a vehicle owned by the authenticated user."""
    service = VehicleService(session)
    await service.delete_vehicle(
        vehicle_id=vehicle_id,
        owner_id=current_user.id,
    )