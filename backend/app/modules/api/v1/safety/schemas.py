"""Pydantic schemas for Safety and Incident Reporting."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IncidentReportCreate(BaseModel):
    """Payload to submit a safety or conduct report."""

    reported_user_id: UUID | None = None
    ride_id: UUID | None = None
    category: str = Field(min_length=1, max_length=64, description="Category of incident e.g. safety, harassment, vehicle_mismatch, payment, other")
    description: str = Field(min_length=5, max_length=2000)


class IncidentReportResponse(BaseModel):
    """Incident report representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reporter_id: UUID
    reported_user_id: UUID | None = None
    ride_id: UUID | None = None
    category: str
    description: str
    status: str
    admin_notes: str | None = None
    resolved_by: UUID | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class IncidentReportListResponse(BaseModel):
    """Paginated collection of incident reports."""

    items: list[IncidentReportResponse]
    total: int
