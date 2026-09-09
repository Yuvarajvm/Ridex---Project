"""Database access layer for RIDEX reviews."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.api.v1.reviews.models import Review
from app.modules.api.v1.users.models import User


class ReviewRepository:
    """Encapsulates database operations for reviews."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, review: Review) -> Review:
        """Persist a new review."""
        self.session.add(review)
        await self.session.flush()
        await self.session.refresh(review)
        return review

    async def get_by_id(self, review_id: UUID) -> Review | None:
        """Fetch review with eager reviewer profile."""
        statement = (
            select(Review)
            .options(
                joinedload(Review.reviewer).joinedload(User.profile),
            )
            .where(
                Review.id == review_id,
                Review.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_review_by_participants(
        self,
        ride_id: UUID,
        reviewer_id: UUID,
        reviewee_id: UUID,
    ) -> Review | None:
        """Find existing review between participants on a ride."""
        statement = select(Review).where(
            Review.ride_id == ride_id,
            Review.reviewer_id == reviewer_id,
            Review.reviewee_id == reviewee_id,
            Review.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Review], int, float]:
        """Return paginated reviews received by a user, plus their average rating."""
        offset = (page - 1) * page_size

        statement = (
            select(Review)
            .options(
                joinedload(Review.reviewer).joinedload(User.profile),
            )
            .where(
                Review.reviewee_id == user_id,
                Review.deleted_at.is_(None),
            )
            .order_by(Review.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        count_statement = select(
            func.count(Review.id),
            func.coalesce(func.avg(Review.rating), 0.0),
        ).where(
            Review.reviewee_id == user_id,
            Review.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)
        stats_result = await self.session.execute(count_statement)

        reviews = list(result.scalars().unique().all())
        total, avg_rating = stats_result.one()

        return reviews, total, float(avg_rating)

    async def get_user_stats(
        self,
        user_id: UUID,
    ) -> tuple[float, int, dict[int, int]]:
        """Compute rating breakdown distribution for user."""
        avg_query = select(
            func.count(Review.id),
            func.coalesce(func.avg(Review.rating), 0.0),
        ).where(
            Review.reviewee_id == user_id,
            Review.deleted_at.is_(None),
        )
        avg_result = await self.session.execute(avg_query)
        total, avg_rating = avg_result.one()

        breakdown = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        dist_query = (
            select(Review.rating, func.count(Review.id))
            .where(
                Review.reviewee_id == user_id,
                Review.deleted_at.is_(None),
            )
            .group_by(Review.rating)
        )
        dist_result = await self.session.execute(dist_query)
        for rating, count in dist_result.all():
            breakdown[rating] = count

        return float(avg_rating), total, breakdown
