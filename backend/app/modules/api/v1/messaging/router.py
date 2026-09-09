"""HTTP routes for ride trip messaging."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.messaging.schemas import (
    TripMessageCreate,
    TripMessageListResponse,
    TripMessageResponse,
)
from app.modules.api.v1.messaging.service import MessagingService
from app.modules.api.v1.users.models import User

router = APIRouter(tags=["Trip Messaging"])


@router.get(
    "/rides/{ride_id}/messages",
    response_model=TripMessageListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_ride_messages(
    ride_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> TripMessageListResponse:
    """Retrieve all trip messages for confirmed ride participants."""
    service = MessagingService(session)
    messages, total = await service.list_messages(
        ride_id=ride_id,
        user_id=current_user.id,
    )
    return TripMessageListResponse(
        items=[TripMessageResponse.model_validate(m) for m in messages],
        total=total,
    )


@router.post(
    "/rides/{ride_id}/messages",
    response_model=TripMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_ride_message(
    ride_id: UUID,
    payload: TripMessageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> TripMessageResponse:
    """Post a new message in the trip chat for a ride."""
    service = MessagingService(session)
    message = await service.post_message(
        ride_id=ride_id,
        user_id=current_user.id,
        payload=payload,
    )
    return TripMessageResponse.model_validate(message)
