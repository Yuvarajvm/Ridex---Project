"""Pydantic schemas for RIDEX Admin Operations."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AdminReportUpdate(BaseModel):
    """Payload for admin resolving or changing incident report status."""

    status: Literal["pending", "investigating", "resolved", "dismissed"]
    admin_notes: str | None = Field(default=None, max_length=2000)


class AdminPlatformStats(BaseModel):
    """Aggregate metrics across the RIDEX platform — all from real DB queries."""

    # Users
    total_users: int
    active_users: int
    suspended_users: int
    total_drivers: int
    total_riders: int

    # Vehicles
    total_vehicles: int
    verified_vehicles: int
    pending_vehicles: int
    rejected_vehicles: int

    # Rides
    total_rides: int
    scheduled_rides: int
    in_progress_rides: int
    completed_rides: int
    cancelled_rides: int

    # Bookings
    total_bookings: int
    confirmed_bookings: int
    completed_bookings: int
    cancelled_bookings: int
    rejected_bookings: int

    # Financials (INR)
    total_transactions: int
    succeeded_payments: int
    failed_payments: int
    refunded_payments: int
    total_revenue: float
    total_payments_amount: float = 0.0

    # Safety
    total_reports: int
    open_reports: int
    open_reports_count: int = 0
    resolved_reports: int
    dismissed_reports: int


class AdminUserStatusUpdate(BaseModel):
    """Payload to update user account security status."""

    status: Literal["active", "suspended", "pending_verification", "deactivated"]


class AdminVehicleVerificationUpdate(BaseModel):
    """Payload for admin approving or rejecting a vehicle."""

    verification_status: Literal["verified", "rejected"]
    rejected_reason: str | None = Field(default=None, max_length=500)


class AdminVehicleItem(BaseModel):
    """Admin vehicle summary with owner context."""

    id: UUID
    owner_id: UUID
    owner_email: str | None = None
    make: str
    model: str
    year: int | None = None
    color: str | None = None
    registration_number: str
    vehicle_type: str
    seat_capacity: int
    verification_status: str
    created_at: str
    verified_at: str | None = None
    rejected_reason: str | None = None


class AdminVehicleListResponse(BaseModel):
    items: list[AdminVehicleItem]
    total: int


class AdminUserItem(BaseModel):
    """Admin user summary item."""

    id: UUID
    email: str
    phone_number: str | None = None
    role: str
    status: str
    first_name: str | None = None
    last_name: str | None = None
    created_at: str


class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int


class AdminRideItem(BaseModel):
    """Admin marketplace ride item."""

    id: UUID
    driver_id: UUID
    driver_email: str | None = None
    origin: str
    destination: str
    departure_time: str
    available_seats: int
    price_per_seat: float
    status: str
    is_women_only: bool
    created_at: str


class AdminRideListResponse(BaseModel):
    items: list[AdminRideItem]
    total: int

