"""Pydantic schemas for the RIDEX Vehicles API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VehicleCreate(BaseModel):
    """Payload for registering a new vehicle."""

    vehicle_type: str = Field(
        min_length=1,
        max_length=30,
    )

    make: str = Field(
        min_length=1,
        max_length=100,
    )

    model: str = Field(
        min_length=1,
        max_length=100,
    )

    color: str | None = Field(
        default=None,
        max_length=60,
    )

    registration_number: str = Field(
        min_length=1,
        max_length=30,
    )

    registration_state: str | None = Field(
        default=None,
        max_length=120,
    )

    manufacture_year: int | None = Field(
        default=None,
        ge=1990,
    )

    seat_capacity: int = Field(
        ge=1,
        le=8,
    )

    @field_validator(
        "vehicle_type",
        "make",
        "model",
        "registration_state",
        "color",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        """Trim text fields before validation/persistence."""

        if value is None:
            return None

        value = value.strip()

        return value or None

    @field_validator("registration_number", mode="before")
    @classmethod
    def normalize_registration_number(cls, value: str) -> str:
        """Normalize registration numbers to uppercase."""

        if not isinstance(value, str):
            raise ValueError("Registration number must be a string.")

        value = value.strip().upper()

        if not value:
            raise ValueError("Registration number cannot be empty.")

        return value


class VehicleUpdate(BaseModel):
    """Payload for updating an existing vehicle."""

    vehicle_type: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    make: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    model: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    color: str | None = Field(
        default=None,
        max_length=60,
    )

    registration_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    registration_state: str | None = Field(
        default=None,
        max_length=120,
    )

    manufacture_year: int | None = Field(
        default=None,
        ge=1990,
    )

    seat_capacity: int | None = Field(
        default=None,
        ge=1,
        le=8,
    )

    @field_validator(
        "vehicle_type",
        "make",
        "model",
        "registration_state",
        "color",
        mode="before",
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        """Trim update text values."""

        if value is None:
            return None

        value = value.strip()

        return value or None

    @field_validator("registration_number", mode="before")
    @classmethod
    def normalize_registration_number(
        cls,
        value: str | None,
    ) -> str | None:
        """Normalize updated registration numbers."""

        if value is None:
            return None

        value = value.strip().upper()

        if not value:
            raise ValueError("Registration number cannot be empty.")

        return value


class VehicleResponse(BaseModel):
    """Public vehicle representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID

    vehicle_type: str
    make: str
    model: str
    color: str | None

    registration_number: str
    registration_state: str | None

    manufacture_year: int | None
    seat_capacity: int

    verification_status: str
    verified_at: datetime | None
    rejected_reason: str | None

    is_active: bool

    created_at: datetime
    updated_at: datetime


class VehicleListResponse(BaseModel):
    """Paginated vehicle collection."""

    items: list[VehicleResponse]
    total: int
    page: int
    page_size: int