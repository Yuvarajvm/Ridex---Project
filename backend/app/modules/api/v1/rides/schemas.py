"""Pydantic schemas for the RIDEX ride API."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RideCreate(BaseModel):
    """Payload for creating a ride."""

    vehicle_id: UUID
    origin: str = Field(min_length=1, max_length=200)
    destination: str = Field(min_length=1, max_length=200)
    departure_at: datetime
    available_seats: int = Field(ge=1, le=8)
    price_per_seat: Decimal = Field(ge=Decimal("10.00"), decimal_places=2)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("origin", "destination")
    @classmethod
    def normalize_location(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Location cannot be empty.")
        return value

    @field_validator("destination")
    @classmethod
    def validate_destination(
        cls,
        value: str,
        info,
    ) -> str:
        origin = info.data.get("origin")
        if origin and value.casefold() == origin.casefold():
            raise ValueError("Origin and destination must be different.")
        return value


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
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class RideListResponse(BaseModel):
    """Paginated ride search response."""

    items: list[RideResponse]
    total: int
    page: int
    page_size: int
    
class LocationSuggestion(BaseModel):
    name: str


class RideAvailabilityResponse(BaseModel):
    origin: str
    destination: str
    month: str
    available_dates: list[date]