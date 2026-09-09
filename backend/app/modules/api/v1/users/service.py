"""Business service for users and profiles."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.api.v1.users.models import Profile, User
from app.modules.api.v1.users.repository import UserRepository
from app.modules.api.v1.users.schemas import ProfileUpdateRequest, PublicUserResponse


class UserService:
    """Service handling profile management and public user queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = UserRepository(session)

    async def get_user_details(self, user_id: UUID) -> User:
        """Fetch full user account including profile."""
        user = await self.repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return user

    async def update_profile(
        self,
        user_id: UUID,
        payload: ProfileUpdateRequest,
    ) -> Profile:
        """Update authenticated user's profile information."""
        profile = await self.repository.get_profile_by_user_id(user_id)
        if profile is None:
            raise NotFoundError("Profile not found.")

        updates = payload.model_dump(exclude_unset=True)
        # Strip strings if provided
        for key, value in list(updates.items()):
            if isinstance(value, str):
                updates[key] = value.strip() or None

        updated_profile = await self.repository.update_profile(profile, updates)
        await self.session.commit()
        return updated_profile

    async def get_public_user(self, user_id: UUID) -> PublicUserResponse:
        """Fetch sanitized public representation of a user without sensitive data."""
        user = await self.repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")

        first_name = user.profile.first_name if user.profile else "User"
        display_name = user.profile.display_name if user.profile else None
        avatar_url = user.profile.avatar_url if user.profile else None
        bio = user.profile.bio if user.profile else None
        city = user.profile.city if user.profile else None

        return PublicUserResponse(
            id=user.id,
            first_name=first_name,
            display_name=display_name,
            avatar_url=avatar_url,
            bio=bio,
            city=city,
            role=user.role,
            created_at=user.created_at,
        )
