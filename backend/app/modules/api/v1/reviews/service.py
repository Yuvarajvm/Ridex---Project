"""Business logic for RIDEX reviews and rating analytics."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
)
from app.modules.api.v1.bookings.repository import BookingRepository
from app.modules.api.v1.reviews.models import Review
from app.modules.api.v1.reviews.repository import ReviewRepository
from app.modules.api.v1.reviews.schemas import ReviewCreate, UserRatingSummary
from app.modules.api.v1.rides.repository import RideRepository
from app.modules.api.v1.users.repository import UserRepository


class ReviewService:
    """Application service for verified user reviews."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = ReviewRepository(session)
        self.ride_repository = RideRepository(session)
        self.booking_repository = BookingRepository(session)
        self.user_repository = UserRepository(session)

    async def create_review(
        self,
        reviewer_id: UUID,
        payload: ReviewCreate,
    ) -> Review:
        """Create a verified review for a co-traveler on a ride."""
        if reviewer_id == payload.reviewee_id:
            raise ConflictError("You cannot submit a review for yourself.")

        if payload.rating < 1 or payload.rating > 5:
            raise ValueError("Rating must be between 1 and 5 stars.")

        # 1. Verify ride exists and timing
        ride = await self.ride_repository.get_by_id(payload.ride_id)
        if ride is None:
            raise NotFoundError("Ride not found.")

        now = datetime.now(timezone.utc)
        if ride.departure_at > now and ride.status not in {"completed", "in_progress"}:
            raise ConflictError("You can only review a ride that has departed or completed.")

        # 2. Verify co-travel eligibility
        is_passenger_reviewing_driver = (
            ride.driver_id == payload.reviewee_id
        )
        is_driver_reviewing_passenger = (
            ride.driver_id == reviewer_id
        )

        if is_passenger_reviewing_driver:
            booking = await self.booking_repository.get_booking_for_rider_and_ride(
                rider_id=reviewer_id,
                ride_id=ride.id,
            )
            if booking is None or booking.status not in {"confirmed", "completed"}:
                raise AuthorizationError(
                    "You can only review the driver if you booked a seat on this ride."
                )
        elif is_driver_reviewing_passenger:
            booking = await self.booking_repository.get_booking_for_rider_and_ride(
                rider_id=payload.reviewee_id,
                ride_id=ride.id,
            )
            if booking is None or booking.status not in {"confirmed", "completed"}:
                raise AuthorizationError(
                    "You can only review a passenger who had a reservation on your ride."
                )
        else:
            raise AuthorizationError(
                "Reviews are only permitted between verified drivers and passengers of the ride."
            )

        # 3. Check for existing review
        existing = await self.repository.get_review_by_participants(
            ride_id=ride.id,
            reviewer_id=reviewer_id,
            reviewee_id=payload.reviewee_id,
        )
        if existing is not None:
            raise ConflictError("You have already reviewed this participant for this ride.")

        review = Review(
            ride_id=ride.id,
            reviewer_id=reviewer_id,
            reviewee_id=payload.reviewee_id,
            rating=payload.rating,
            comment=payload.comment.strip() if payload.comment else None,
        )

        created = await self.repository.create(review)
        await self.session.commit()

        loaded = await self.repository.get_by_id(created.id)
        return loaded or created

    async def list_user_reviews(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Review], int, float]:
        """Return reviews received by a user."""
        return await self.repository.list_for_user(
            user_id=user_id,
            page=page,
            page_size=page_size,
        )

    async def get_user_rating_summary(
        self,
        user_id: UUID,
    ) -> UserRatingSummary:
        """Return rating average and breakdown for profile."""
        avg_rating, total, breakdown = await self.repository.get_user_stats(user_id)
        return UserRatingSummary(
            user_id=user_id,
            average_rating=round(avg_rating, 2),
            total_reviews=total,
            breakdown=breakdown,
        )
