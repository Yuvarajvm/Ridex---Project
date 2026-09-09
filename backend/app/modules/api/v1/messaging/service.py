"""Application service for trip discussions and messages."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, NotFoundError
from app.modules.api.v1.bookings.models import Booking
from app.modules.api.v1.messaging.models import TripMessage
from app.modules.api.v1.messaging.repository import TripMessageRepository
from app.modules.api.v1.messaging.schemas import TripMessageCreate
from app.modules.api.v1.notifications.models import Notification
from app.modules.api.v1.notifications.repository import NotificationRepository
from app.modules.api.v1.rides.repository import RideRepository


class MessagingService:
    """Service handling verified in-ride chat communication."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = TripMessageRepository(session)
        self.ride_repository = RideRepository(session)
        self.notification_repository = NotificationRepository(session)

    async def _verify_participant(self, ride_id: UUID, user_id: UUID) -> tuple[bool, bool, list[UUID]]:
        """Verify user is driver or confirmed passenger.

        Returns (is_driver, is_passenger, all_other_participant_user_ids).
        """
        ride = await self.ride_repository.get_by_id(ride_id)
        if ride is None:
            raise NotFoundError("Ride not found.")

        # Query all active bookings for this ride
        stmt = (
            select(Booking)
            .where(
                Booking.ride_id == ride_id,
                Booking.status.in_(["confirmed", "completed"]),
            )
        )
        res = await self.session.execute(stmt)
        active_bookings = list(res.scalars().all())

        confirmed_rider_ids = [b.rider_id for b in active_bookings]

        is_driver = ride.driver_id == user_id
        is_passenger = user_id in confirmed_rider_ids

        if not (is_driver or is_passenger):
            raise AuthorizationError(
                "Access denied. Only the ride host and confirmed passengers can participate in trip chat."
            )

        # Collect recipients for notification: all other participants
        all_other_ids = set(confirmed_rider_ids)
        all_other_ids.add(ride.driver_id)
        all_other_ids.discard(user_id)

        return is_driver, is_passenger, list(all_other_ids)

    async def list_messages(self, ride_id: UUID, user_id: UUID) -> tuple[list[TripMessage], int]:
        """Return all messages for ride if user is participant."""
        await self._verify_participant(ride_id, user_id)
        return await self.repository.list_for_ride(ride_id)

    async def post_message(
        self,
        ride_id: UUID,
        user_id: UUID,
        payload: TripMessageCreate,
    ) -> TripMessage:
        """Create a new message and dispatch notifications to other participants."""
        _, _, recipient_ids = await self._verify_participant(ride_id, user_id)

        clean_content = payload.content.strip()
        if not clean_content:
            raise ValueError("Message content cannot be blank.")

        message = TripMessage(
            ride_id=ride_id,
            sender_id=user_id,
            content=clean_content,
        )
        created = await self.repository.create(message)

        # Dispatch notifications to other participants
        for recipient_id in recipient_ids:
            notif = Notification(
                user_id=recipient_id,
                type="trip_message",
                title="New message in trip chat",
                message=clean_content[:120] + ("..." if len(clean_content) > 120 else ""),
                data={"ride_id": str(ride_id), "message_id": str(created.id)},
                is_read=False,
            )
            await self.notification_repository.create(notif)

        await self.session.commit()

        loaded = await self.repository.get_by_id(created.id)
        return loaded or created
