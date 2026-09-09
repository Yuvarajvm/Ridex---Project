"""Pydantic schemas for RIDEX Admin Operations."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AdminReportUpdate(BaseModel):
    """Payload for admin resolving or changing incident report status."""

    status: Literal["pending", "investigating", "resolved", "dismissed"]
    admin_notes: str | None = Field(default=None, max_length=2000)


class AdminPlatformStats(BaseModel):
    """Aggregate metrics across the RIDEX platform."""

    total_users: int
    total_drivers: int
    total_rides: int
    total_bookings: int
    total_payments_amount: float
    open_reports_count: int


class AdminUserStatusUpdate(BaseModel):
    """Payload to update user account security status."""

    status: Literal["active", "suspended", "pending_verification", "deactivated"]
