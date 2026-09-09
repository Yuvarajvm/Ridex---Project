"""Pydantic schemas for the RIDEX Notifications API."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    """Payload to create an internal user notification."""

    user_id: UUID
    type: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    data: dict[str, Any] | None = None


class NotificationResponse(BaseModel):
    """Notification response returned to client."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    data: dict[str, Any] | None = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Paginated collection of user notifications with unread count."""

    items: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int


class BatchReadResponse(BaseModel):
    """Response after marking notifications as read."""

    updated_count: int
