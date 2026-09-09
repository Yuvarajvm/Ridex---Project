"""Pydantic schemas for the RIDEX Payments API."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentIntentRequest(BaseModel):
    """Payload to initiate checkout for a booking."""

    booking_id: UUID


class PaymentIntentResponse(BaseModel):
    """Checkout intent metadata returned to client."""

    payment_id: UUID
    booking_id: UUID
    amount: Decimal
    currency: str
    status: str
    provider: str
    provider_order_id: str | None
    client_secret: str | None


class ProcessPaymentRequest(BaseModel):
    """Payload to authorize and capture payment."""

    payment_id: UUID
    payment_method: str = Field(default="upi", pattern="^(upi|card|netbanking|wallet)$")
    simulate_failure: bool = False


class PaymentResponse(BaseModel):
    """Full payment record representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_id: UUID
    payer_id: UUID
    amount: Decimal
    currency: str
    provider: str
    status: str
    provider_payment_id: str | None = None
    provider_order_id: str | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class PaymentListResponse(BaseModel):
    """Paginated collection of user payments."""

    items: list[PaymentResponse]
    total: int
    page: int
    page_size: int
