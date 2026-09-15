"""Pydantic schemas for the RIDEX Bookings API."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.api.v1.rides.schemas import DriverSummary, VehicleSummary


class BookingCreate(BaseModel):
    """Payload for creating a new booking request."""

    ride_id: UUID
    seats_booked: int = Field(default=1, ge=1, le=8)


class RideSummaryForBooking(BaseModel):
    """Summary of the booked ride."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    driver_id: UUID
    origin: str
    destination: str
    departure_at: datetime
    price_per_seat: Decimal
    status: str
    driver: DriverSummary | None = None
    vehicle: VehicleSummary | None = None


class RiderSummaryForBooking(BaseModel):
    """Summary of the passenger who booked the seat."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None = None
    email: str | None = None
    phone_number: str | None = None
    avatar_url: str | None = None


class BookingResponse(BaseModel):
    """Full booking entity returned by API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ride_id: UUID
    rider_id: UUID
    seats_booked: int
    total_fare: Decimal
    status: str
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    ride: RideSummaryForBooking | None = None
    rider: RiderSummaryForBooking | None = None


class BookingListResponse(BaseModel):
    """Paginated collection of bookings."""

    items: list[BookingResponse]
    total: int
    page: int
    page_size: int


class BookingCancelRequest(BaseModel):
    """Payload for cancelling a booking."""

    reason: str | None = Field(default=None, max_length=500)
