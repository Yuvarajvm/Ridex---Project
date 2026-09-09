"""Pydantic schemas for the RIDEX Reviews API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    """Payload to submit a driver or passenger review."""

    ride_id: UUID
    reviewee_id: UUID
    rating: int = Field(ge=1, le=5, description="1 to 5 star rating")
    comment: str | None = Field(default=None, max_length=1000)


class ReviewerSummary(BaseModel):
    """Public summary of the review author."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None = None
    avatar_url: str | None = None


class ReviewResponse(BaseModel):
    """Full review record returned by API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ride_id: UUID
    reviewer_id: UUID
    reviewee_id: UUID
    rating: int
    comment: str | None = None
    created_at: datetime
    reviewer: ReviewerSummary | None = None


class ReviewListResponse(BaseModel):
    """Paginated collection of reviews for a user."""

    items: list[ReviewResponse]
    total: int
    average_rating: float
    page: int
    page_size: int


class UserRatingSummary(BaseModel):
    """Aggregated rating telemetry for a driver or passenger profile."""

    user_id: UUID
    average_rating: float
    total_reviews: int
    breakdown: dict[int, int]
