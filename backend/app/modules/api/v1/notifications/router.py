"""HTTP routes for the RIDEX Notifications module."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.notifications.schemas import (
    BatchReadResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.modules.api.v1.notifications.service import NotificationService
from app.modules.api.v1.users.models import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_notifications(
    unread_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> NotificationListResponse:
    """List authenticated user's notifications and unread counter."""
    service = NotificationService(session)
    items, total, unread_count = await service.list_user_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        page=page,
        page_size=page_size,
    )
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
)
async def mark_notification_as_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> NotificationResponse:
    """Mark a single notification as read."""
    service = NotificationService(session)
    notification = await service.mark_as_read(
        notification_id=notification_id,
        user_id=current_user.id,
    )
    return NotificationResponse.model_validate(notification)


@router.post(
    "/mark-all-read",
    response_model=BatchReadResponse,
    status_code=status.HTTP_200_OK,
)
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BatchReadResponse:
    """Mark all unread notifications as read."""
    service = NotificationService(session)
    updated = await service.mark_all_as_read(user_id=current_user.id)
    return BatchReadResponse(updated_count=updated)
