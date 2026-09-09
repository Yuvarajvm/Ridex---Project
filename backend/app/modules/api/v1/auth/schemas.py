"""Pydantic schemas for RIDEX authentication."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class RegisterRequest(BaseModel):
    """User registration payload."""

    email: str = Field(
        min_length=3,
        max_length=320,
        pattern=EMAIL_PATTERN,
        description="User email address",
    )
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)
    role: Literal["rider", "driver"] = "rider"


class LoginRequest(BaseModel):
    """User credential login payload."""

    email: str = Field(
        min_length=3,
        max_length=320,
        pattern=EMAIL_PATTERN,
        description="User email address",
    )
    password: str = Field(min_length=1, max_length=128)


class UserProfileResponse(BaseModel):
    """Profile details in auth responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    city: str | None = None


class AuthUserResponse(BaseModel):
    """Authenticated user response with profile summary."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    phone_number: str | None = None
    role: str
    status: str
    profile: UserProfileResponse | None = None


class TokenResponse(BaseModel):
    """Access token issued upon successful authentication."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUserResponse
