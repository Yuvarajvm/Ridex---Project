"""Database repository for ride messages."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.api.v1.messaging.models import TripMessage
from app.modules.api.v1.users.models import User


class TripMessageRepository:
    """Encapsulates database operations for trip messages."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, message: TripMessage) -> TripMessage:
        """Persist a new trip message."""
        self.session.add(message)
        await self.session.flush()
        return message

    async def get_by_id(self, message_id: UUID) -> TripMessage | None:
        """Fetch a message with sender details."""
        stmt = (
            select(TripMessage)
            .where(TripMessage.id == message_id)
            .options(
                joinedload(TripMessage.sender).joinedload(User.profile)
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_for_ride(self, ride_id: UUID) -> tuple[list[TripMessage], int]:
        """Fetch all messages for a ride in chronological order."""
        total_stmt = select(func.count(TripMessage.id)).where(TripMessage.ride_id == ride_id)
        total_res = await self.session.execute(total_stmt)
        total = total_res.scalar_one() or 0

        stmt = (
            select(TripMessage)
            .where(TripMessage.ride_id == ride_id)
            .options(
                joinedload(TripMessage.sender).joinedload(User.profile)
            )
            .order_by(TripMessage.created_at.asc())
        )
        res = await self.session.execute(stmt)
        items = list(res.scalars().unique().all())
        return items, total
