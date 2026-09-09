"""Data access repository for users and profiles."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.api.v1.users.models import Profile, User


class UserRepository:
    """Repository handling User and Profile queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        """Fetch user by ID with eager loaded profile."""
        stmt = (
            select(User)
            .options(joinedload(User.profile))
            .where(
                User.id == user_id,
                User.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_profile_by_user_id(self, user_id: UUID) -> Profile | None:
        """Fetch profile by associated user ID."""
        stmt = select(Profile).where(
            Profile.user_id == user_id,
            Profile.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_profile(self, profile: Profile, updates: dict) -> Profile:
        """Update profile fields and mark completion if appropriate."""
        for field, value in updates.items():
            setattr(profile, field, value)

        # Mark profile completed if first_name and city or bio are present
        if profile.first_name and (profile.city or profile.bio):
            if not profile.profile_completed_at:
                profile.profile_completed_at = datetime.now(timezone.utc)

        await self.session.flush()
        await self.session.refresh(profile)
        return profile
