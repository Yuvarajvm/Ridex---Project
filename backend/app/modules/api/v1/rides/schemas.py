"""Pydantic schemas for the RIDEX ride marketplace."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RideCreate(BaseModel):
    """Payload for creating a ride."""

    vehicle_id: UUID
    origin: str = Field(min_length=1, max_length=200)
    destination: str = Field(min_length=1, max_length=200)
    departure_at: datetime
    available_seats: int = Field(ge=1, le=8)
    price_per_seat: Decimal = Field(ge=Decimal("10.00"))
    is_women_only: bool = False
    notes: str | None = Field(default=None, max_length=2000)


class RideStatusUpdate(BaseModel):
    """Payload for updating ride status."""

    status: str = Field(pattern="^(scheduled|in_progress|completed|cancelled)$")


class DriverSummary(BaseModel):
    """Driver summary embedded in public ride response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None = None
    avatar_url: str | None = None


class VehicleSummary(BaseModel):
    """Vehicle summary embedded in public ride response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vehicle_type: str
    make: str
    model: str
    color: str | None = None
    registration_number: str
    seat_capacity: int


class RideResponse(BaseModel):
    """Public ride representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    driver_id: UUID
    vehicle_id: UUID
    origin: str
    destination: str
    departure_at: datetime
    available_seats: int
    price_per_seat: Decimal
    is_women_only: bool = False
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    driver: DriverSummary | None = None
    vehicle: VehicleSummary | None = None


class RideListResponse(BaseModel):
    """Paginated ride search response."""

    items: list[RideResponse]
    total: int
    page: int
    page_size: int


class LocationSuggestion(BaseModel):
    """Location autocomplete result."""

    name: str


class RideAvailabilityResponse(BaseModel):
    """Available ride dates for a route and calendar month."""

    origin: str
    destination: str
    month: str
    dates: list[date]


class RideCancelRequest(BaseModel):
    """Payload for cancelling an offered ride."""

    reason: str | None = Field(default=None, max_length=500)