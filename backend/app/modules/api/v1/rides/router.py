"""HTTP routes for the RIDEX ride marketplace."""

from datetime import datetime, timezone
from uuid import UUID
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.rides.schemas import (
    RideCreate,
    RideListResponse,
    RideResponse,
    LocationSuggestion,
    RideAvailabilityResponse,
)
from app.modules.api.v1.rides.service import RideService


router = APIRouter(
    prefix="/rides",
    tags=["Rides"],
)


async def get_demo_user_id() -> UUID:
    """
    Temporary demo identity.

    Authentication will replace this dependency in Day 5.
    No authentication logic is implemented here.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Authentication is not available yet.",
    )


@router.post(
    "",
    response_model=RideResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ride(
    payload: RideCreate,
    session: AsyncSession = Depends(get_db_session),
    driver_id: UUID = Depends(get_demo_user_id),
) -> RideResponse:
    service = RideService(session)

    try:
        ride = await service.create_ride(
            driver_id=driver_id,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    await session.commit()

    return RideResponse.model_validate(ride)


@router.get(
    "",
    response_model=RideListResponse,
)
async def search_rides(
    origin: str | None = Query(default=None, max_length=200),
    destination: str | None = Query(default=None, max_length=200),
    departure_from: datetime | None = None,
    departure_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> RideListResponse:
    service = RideService(session)

    rides, total = await service.search_rides(
        origin=origin.strip() if origin else None,
        destination=destination.strip() if destination else None,
        departure_from=departure_from,
        departure_to=departure_to,
        page=page,
        page_size=page_size,
    )

    return RideListResponse(
        items=[RideResponse.model_validate(ride) for ride in rides],
        total=total,
        page=page,
        page_size=page_size,
    )
@router.get(
    "/locations",
    response_model=list[LocationSuggestion],
)
async def search_locations(
    query: str | None = Query(default=None, max_length=100),
    session: AsyncSession = Depends(get_db_session),
) -> list[LocationSuggestion]:
    service = RideService(session)

    locations = await service.search_locations(
        query=query.strip() if query else None,
        limit=8,
    )

    return [
        LocationSuggestion(name=location)
        for location in locations
    ]
@router.get(
    "/availability",
    response_model=RideAvailabilityResponse,
)
async def get_ride_availability(
    origin: str = Query(..., min_length=1, max_length=200),
    destination: str = Query(..., min_length=1, max_length=200),
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    session: AsyncSession = Depends(get_db_session),
) -> RideAvailabilityResponse:
    try:
        year, month_number = map(int, month.split("-"))

        if not 1 <= month_number <= 12:
            raise ValueError

        month_start = datetime(
            year,
            month_number,
            1,
            tzinfo=timezone.utc,
        )

        if month_number == 12:
            month_end = datetime(
                year + 1,
                1,
                1,
                tzinfo=timezone.utc,
            )
        else:
            month_end = datetime(
                year,
                month_number + 1,
                1,
                tzinfo=timezone.utc,
            )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be in YYYY-MM format.",
        ) from exc

    service = RideService(session)

    departures = await service.get_available_dates(
        origin=origin,
        destination=destination,
        month_start=month_start,
        month_end=month_end,
    )

    available_dates = sorted(
        {
            departure.date()
            for departure in departures
        }
    )

    return RideAvailabilityResponse(
        origin=origin.strip(),
        destination=destination.strip(),
        month=f"{year:04d}-{month_number:02d}",
        available_dates=available_dates,
    )
@router.get(
    "/{ride_id}",
    response_model=RideResponse,
)
async def get_ride(
    ride_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> RideResponse:
    service = RideService(session)

    ride = await service.get_ride(ride_id)

    if ride is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found.",
        )

    return RideResponse.model_validate(ride)