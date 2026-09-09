"""HTTP routes for the RIDEX Reviews module."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.reviews.schemas import (
    ReviewCreate,
    ReviewListResponse,
    ReviewResponse,
    UserRatingSummary,
)
from app.modules.api.v1.reviews.service import ReviewService
from app.modules.api.v1.users.models import User

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post(
    "",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReviewResponse:
    """Submit a verified rating and review for a driver or co-passenger."""
    service = ReviewService(session)
    try:
        review = await service.create_review(
            reviewer_id=current_user.id,
            payload=payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return ReviewResponse.model_validate(review)


@router.get(
    "/user/{user_id}",
    response_model=ReviewListResponse,
)
async def list_user_reviews(
    user_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> ReviewListResponse:
    """Return paginated reviews and ratings received by a specific user."""
    service = ReviewService(session)
    reviews, total, avg_rating = await service.list_user_reviews(
        user_id=user_id,
        page=page,
        page_size=page_size,
    )
    return ReviewListResponse(
        items=[ReviewResponse.model_validate(r) for r in reviews],
        total=total,
        average_rating=round(avg_rating, 2),
        page=page,
        page_size=page_size,
    )


@router.get(
    "/user/{user_id}/summary",
    response_model=UserRatingSummary,
)
async def get_user_rating_summary(
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> UserRatingSummary:
    """Return aggregated rating score and star breakdown for a user profile."""
    service = ReviewService(session)
    return await service.get_user_rating_summary(user_id)
