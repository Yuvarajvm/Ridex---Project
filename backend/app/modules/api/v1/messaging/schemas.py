"""Pydantic schemas for the RIDEX Trip Messaging API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TripMessageCreate(BaseModel):
    """Payload to post a message in a ride's discussion channel."""

    content: str = Field(min_length=1, max_length=2000)


class MessageSenderSummary(BaseModel):
    """Public summary of message sender."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None = None
    avatar_url: str | None = None


class TripMessageResponse(BaseModel):
    """Trip message representation returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ride_id: UUID
    sender_id: UUID
    content: str
    created_at: datetime
    sender: MessageSenderSummary | None = None


class TripMessageListResponse(BaseModel):
    """Collection of trip messages for a ride."""

    items: list[TripMessageResponse]
    total: int
