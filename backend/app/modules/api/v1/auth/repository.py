"""Data access layer for authentication operations."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.api.v1.users.models import Profile, User


class AuthRepository:
    """Repository handling User and Profile queries for authentication."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        """Fetch active user by normalized email, including profile."""
        normalized_email = email.strip().lower()
        stmt = (
            select(User)
            .options(joinedload(User.profile))
            .where(
                User.email == normalized_email,
                User.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> User | None:
        """Fetch active user by primary key, including profile."""
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

    async def create_user_with_profile(self, user: User, profile: Profile) -> User:
        """Persist a new user and associated profile."""
        self.session.add(user)
        self.session.add(profile)
        await self.session.flush()
        await self.session.refresh(user, attribute_names=["profile"])
        return user

    async def update_last_login(self, user_id: UUID) -> None:
        """Record last login timestamp for user."""
        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(last_login_at=datetime.now(timezone.utc), failed_login_attempts=0)
        )
        await self.session.execute(stmt)
