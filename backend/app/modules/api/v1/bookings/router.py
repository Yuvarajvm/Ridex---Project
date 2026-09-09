"""HTTP routes for the RIDEX Bookings module."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.bookings.schemas import (
    BookingCancelRequest,
    BookingCreate,
    BookingListResponse,
    BookingResponse,
)
from app.modules.api.v1.bookings.service import BookingService
from app.modules.api.v1.users.models import User

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BookingResponse:
    """Request/reserve seats on a scheduled ride."""
    service = BookingService(session)
    booking = await service.create_booking(
        rider_id=current_user.id,
        payload=payload,
    )
    return BookingResponse.model_validate(booking)


@router.get(
    "/my",
    response_model=BookingListResponse,
)
async def list_my_bookings(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BookingListResponse:
    """Return paginated bookings for the authenticated rider."""
    service = BookingService(session)
    bookings, total = await service.list_my_bookings(
        rider_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    return BookingListResponse(
        items=[BookingResponse.model_validate(b) for b in bookings],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/ride/{ride_id}",
    response_model=BookingListResponse,
)
async def list_ride_bookings(
    ride_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BookingListResponse:
    """Return bookings for a ride (accessible by the ride driver)."""
    service = BookingService(session)
    bookings, total = await service.list_ride_bookings(
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


@router.get(
    "/{booking_id}",
    response_model=BookingResponse,
)
async def get_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BookingResponse:
    """Return a single booking by ID."""
    service = BookingService(session)
    booking = await service.get_booking(
        booking_id=booking_id,
        user_id=current_user.id,
    )
    return BookingResponse.model_validate(booking)


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingResponse,
)
async def cancel_booking(
    booking_id: UUID,
    payload: BookingCancelRequest | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BookingResponse:
    """Cancel a booking and release the held seats back to the ride."""
    service = BookingService(session)
    booking = await service.cancel_booking(
        booking_id=booking_id,
        user_id=current_user.id,
        reason=payload.reason if payload else None,
    )
    return BookingResponse.model_validate(booking)


@router.post(
    "/{booking_id}/complete",
    response_model=BookingResponse,
)
async def complete_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BookingResponse:
    """Complete a confirmed booking upon trip arrival."""
    service = BookingService(session)
    booking = await service.complete_booking(
        booking_id=booking_id,
        actor_id=current_user.id,
    )
    return BookingResponse.model_validate(booking)
