"""HTTP routes for user profile management."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.users.models import User
from app.modules.api.v1.users.schemas import (
    ProfileResponse,
    ProfileUpdateRequest,
    PublicUserResponse,
    UserDetailsResponse,
)
from app.modules.api.v1.users.service import UserService

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get(
    "/me",
    response_model=UserDetailsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user's account and profile",
)
async def get_my_details(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserDetailsResponse:
    """Return account and profile information for the authenticated user."""
    service = UserService(session)
    user = await service.get_user_details(current_user.id)
    return UserDetailsResponse.model_validate(user)


@router.patch(
    "/me/profile",
    response_model=ProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Update authenticated user's profile",
)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    """Update profile fields belonging to the authenticated caller."""
    service = UserService(session)
    updated_profile = await service.update_profile(current_user.id, payload)
    return ProfileResponse.model_validate(updated_profile)


@router.get(
    "/{user_id}/public",
    response_model=PublicUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get public profile card of a rider or driver",
)
async def get_public_profile(
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> PublicUserResponse:
    """Return public-safe information about a driver or rider without exposing contact info."""
    service = UserService(session)
    return await service.get_public_user(user_id)
