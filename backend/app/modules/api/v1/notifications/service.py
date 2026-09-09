"""Application service for user notifications."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.api.v1.notifications.models import Notification
from app.modules.api.v1.notifications.repository import NotificationRepository
from app.modules.api.v1.notifications.schemas import NotificationCreate


class NotificationService:
    """Service layer managing user notification dispatch and tracking."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = NotificationRepository(session)

    async def create_notification(self, payload: NotificationCreate) -> Notification:
        """Create and persist a notification."""
        notification = Notification(
            user_id=payload.user_id,
            type=payload.type,
            title=payload.title,
            message=payload.message,
            data=payload.data,
            is_read=False,
        )
        created = await self.repository.create(notification)
        await self.session.commit()
        await self.session.refresh(created)
        return created

    async def list_user_notifications(
        self,
        user_id: UUID,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Notification], int, int]:
        """Fetch notifications and unread stats."""
        return await self.repository.list_for_user(
            user_id=user_id,
            unread_only=unread_only,
            page=page,
            page_size=page_size,
        )

    async def mark_as_read(
        self,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification:
        """Mark a notification as read with ownership verification."""
        notification = await self.repository.mark_as_read(
            notification_id=notification_id,
            user_id=user_id,
        )
        if notification is None:
            raise NotFoundError("Notification not found.")

        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all unread notifications for a user as read."""
        count = await self.repository.mark_all_as_read(user_id=user_id)
        await self.session.commit()
        return count
