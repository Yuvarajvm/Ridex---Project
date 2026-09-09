"""Database repository for notifications."""

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.notifications.models import Notification


class NotificationRepository:
    """Encapsulates database access for notifications."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, notification: Notification) -> Notification:
        """Persist a new notification."""
        self.session.add(notification)
        await self.session.flush()
        return notification

    async def get_by_id(self, notification_id: UUID) -> Notification | None:
        """Find a notification by primary key."""
        result = await self.session.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: UUID,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Notification], int, int]:
        """Fetch notifications, total matching count, and overall unread count."""
        # Unread count
        unread_count_stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        unread_count_res = await self.session.execute(unread_count_stmt)
        unread_count = unread_count_res.scalar_one() or 0

        # Base query for filtered list
        base_filter = [Notification.user_id == user_id]
        if unread_only:
            base_filter.append(Notification.is_read.is_(False))

        total_stmt = select(func.count(Notification.id)).where(*base_filter)
        total_res = await self.session.execute(total_stmt)
        total = total_res.scalar_one() or 0

        offset = (page - 1) * page_size
        items_stmt = (
            select(Notification)
            .where(*base_filter)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        items_res = await self.session.execute(items_stmt)
        items = list(items_res.scalars().all())

        return items, total, unread_count

    async def mark_as_read(
        self,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification | None:
        """Mark a single notification belonging to user as read."""
        stmt = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
            .values(is_read=True)
            .returning(Notification)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all unread notifications of a user as read."""
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )
        res = await self.session.execute(stmt)
        # pyrefly: ignore [missing-attribute]
        return res.rowcount
