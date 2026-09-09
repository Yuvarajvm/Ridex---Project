"""Pydantic schemas for users and profiles."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdateRequest(BaseModel):
    """Payload for updating authenticated user profile."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    display_name: str | None = Field(default=None, max_length=160)
    avatar_url: str | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=500)
    date_of_birth: date | None = None
    gender: Literal["male", "female", "non_binary", "prefer_not_to_say"] | None = None
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)


class ProfileResponse(BaseModel):
    """Complete profile details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    first_name: str
    last_name: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    city: str | None = None
    state: str | None = None
    country: str
    profile_completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class UserDetailsResponse(BaseModel):
    """Detailed user account with profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    phone_number: str | None = None
    role: str
    status: str
    profile: ProfileResponse | None = None
    created_at: datetime


class PublicUserResponse(BaseModel):
    """Sanitized public card for drivers and riders (no email or phone)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    city: str | None = None
    role: str
    created_at: datetime
