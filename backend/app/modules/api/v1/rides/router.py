"""HTTP routes for the RIDEX ride marketplace."""

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.bookings.schemas import BookingListResponse, BookingResponse
from app.modules.api.v1.bookings.service import BookingService
from app.modules.api.v1.rides.schemas import (
    LocationSuggestion,
    RideAvailabilityResponse,
    RideCancelRequest,
    RideCreate,
    RideListResponse,
    RideResponse,
    RideStatusUpdate,
)
from app.modules.api.v1.rides.service import RideService
from app.modules.api.v1.users.models import User

router = APIRouter(prefix="/rides", tags=["Rides"])


@router.post(
    "",
    response_model=RideResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ride(
    payload: RideCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> RideResponse:
    """Create a new ride."""

    service = RideService(session)

    try:
        ride = await service.create_ride(
            driver_id=current_user.id,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    await session.commit()

    return RideResponse.model_validate(ride)


@router.patch(
    "/{ride_id}/status",
    response_model=RideResponse,
)
async def update_ride_status(
    ride_id: UUID,
    payload: RideStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RideResponse:
    """Update ride status (scheduled -> in_progress -> completed | cancelled)."""
    service = RideService(session)
    ride = await service.update_ride_status(
        ride_id=ride_id,
        driver_id=current_user.id,
        new_status=payload.status,
    )
    return RideResponse.model_validate(ride)


@router.get(
    "/my",
    response_model=RideListResponse,
)
async def list_my_offered_rides(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RideListResponse:
    """Return paginated list of rides offered/published by the authenticated driver."""
    service = RideService(session)
    rides, total = await service.list_my_offered_rides(
        driver_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    return RideListResponse(
        items=[RideResponse.model_validate(r) for r in rides],
        total=total,
        page=page,
        page_size=page_size,
    )



@router.get(
    "",
    response_model=RideListResponse,
)
async def search_rides(
    origin: str | None = Query(
        default=None,
        max_length=200,
    ),
    destination: str | None = Query(
        default=None,
        max_length=200,
    ),
    date_value: str | None = Query(
        default=None,
        alias="date",
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    session: AsyncSession = Depends(get_db_session),
) -> RideListResponse:
    """Search the ride marketplace."""

    origin = origin.strip() if origin else None
    destination = destination.strip() if destination else None

    if (
        origin
        and destination
        and origin.casefold() == destination.casefold()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Origin and destination must be different.",
        )

    departure_from: datetime | None = None
    departure_to: datetime | None = None

    if date_value is not None:
        try:
            requested_date = date.fromisoformat(date_value)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Date must be in YYYY-MM-DD format.",
            ) from exc

        departure_from = datetime.combine(
            requested_date,
            time.min,
            tzinfo=timezone.utc,
        )
        departure_to = departure_from + timedelta(days=1)

    service = RideService(session)

    try:
        rides, total = await service.search_rides(
            origin=origin,
            destination=destination,
            departure_from=departure_from,
            departure_to=departure_to,
            page=1,
            page_size=limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    return RideListResponse(
        items=[
            RideResponse.model_validate(ride)
            for ride in rides
        ],
        total=total,
        page=1,
        page_size=limit,
    )


@router.get(
    "/locations",
    response_model=list[LocationSuggestion],
)
async def search_locations(
    query: str | None = Query(
        default=None,
        max_length=100,
    ),
    session: AsyncSession = Depends(get_db_session),
) -> list[LocationSuggestion]:
    """Return location suggestions."""

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
    origin: str = Query(
        ...,
        min_length=1,
        max_length=200,
    ),
    destination: str = Query(
        ...,
        min_length=1,
        max_length=200,
    ),
    year: int = Query(
        ...,
        ge=2000,
        le=2100,
    ),
    month: int = Query(
        ...,
        ge=1,
        le=12,
    ),
    session: AsyncSession = Depends(get_db_session),
) -> RideAvailabilityResponse:
    """Return dates containing rides for a route and month."""

    origin = origin.strip()
    destination = destination.strip()

    if not origin or not destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Origin and destination are required.",
        )

    if origin.casefold() == destination.casefold():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Origin and destination must be different.",
        )

    month_start = datetime(
        year,
        month,
        1,
        tzinfo=timezone.utc,
    )

    if month == 12:
        month_end = datetime(
            year + 1,
            1,
            1,
            tzinfo=timezone.utc,
        )
    else:
        month_end = datetime(
            year,
            month + 1,
            1,
            tzinfo=timezone.utc,
        )

    service = RideService(session)

    departures = await service.get_available_dates(
        origin=origin,
        destination=destination,
        month_start=month_start,
        month_end=month_end,
    )

    dates = sorted(
        {
            departure.date()
            for departure in departures
        }
    )

    return RideAvailabilityResponse(
        origin=origin,
        destination=destination,
        month=f"{year:04d}-{month:02d}",
        dates=dates,
    )


@router.get(
    "/{ride_id}",
    response_model=RideResponse,
)
async def get_ride(
    ride_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> RideResponse:
    """Return a single ride."""

    service = RideService(session)

    ride = await service.get_ride(ride_id)

    if ride is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found.",
        )

    return RideResponse.model_validate(ride)


@router.post(
    "/{ride_id}/cancel",
    response_model=RideResponse,
)
async def cancel_ride(
    ride_id: UUID,
    payload: RideCancelRequest | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RideResponse:
    """Cancel an offered ride (as the host driver), releasing held bookings and alerting riders."""
    service = RideService(session)
    ride = await service.cancel_ride_as_driver(
        ride_id=ride_id,
        driver_id=current_user.id,
        reason=payload.reason if payload else None,
    )
    return RideResponse.model_validate(ride)


@router.get(
    "/{ride_id}/bookings",
    response_model=BookingListResponse,
)
async def list_ride_bookings(
    ride_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BookingListResponse:
    """Return passenger bookings for an offered ride (accessible by the host driver)."""
    booking_service = BookingService(session)
    bookings, total = await booking_service.list_ride_bookings(
        ride_id=ride_id,
        driver_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    return BookingListResponse(
        items=[BookingResponse.model_validate(b) for b in bookings],
        total=total,
        page=page,
        page_size=page_size,
    )