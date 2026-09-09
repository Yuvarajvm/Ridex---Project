"""HTTP routes for the RIDEX Payments module."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.payments.schemas import (
    PaymentIntentRequest,
    PaymentIntentResponse,
    PaymentListResponse,
    PaymentResponse,
    ProcessPaymentRequest,
)
from app.modules.api.v1.payments.service import PaymentService
from app.modules.api.v1.users.models import User

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post(
    "/create-intent",
    response_model=PaymentIntentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_intent(
    payload: PaymentIntentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentIntentResponse:
    """Create a checkout intent for a ride booking."""
    service = PaymentService(session)
    return await service.create_payment_intent(
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/process",
    response_model=PaymentResponse,
    status_code=status.HTTP_200_OK,
)
async def process_payment(
    payload: ProcessPaymentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentResponse:
    """Process payment authorization and settlement."""
    service = PaymentService(session)
    payment = await service.process_payment(
        user_id=current_user.id,
        payload=payload,
    )
    return PaymentResponse.model_validate(payment)


@router.get(
    "/my",
    response_model=PaymentListResponse,
)
async def list_my_payments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentListResponse:
    """Return paginated payments made by the authenticated user."""
    service = PaymentService(session)
    payments, total = await service.list_my_payments(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )
    return PaymentListResponse(
        items=[PaymentResponse.model_validate(p) for p in payments],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/booking/{booking_id}",
    response_model=PaymentResponse,
)
async def get_booking_payment(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentResponse:
    """Retrieve payment details for a specific booking."""
    service = PaymentService(session)
    payment = await service.get_payment_by_booking(
        booking_id=booking_id,
        user_id=current_user.id,
    )
    return PaymentResponse.model_validate(payment)


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
)
async def get_payment(
    payment_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaymentResponse:
    """Retrieve a single payment record by ID."""
    service = PaymentService(session)
    payment = await service.get_payment(
        payment_id=payment_id,
        user_id=current_user.id,
    )
    return PaymentResponse.model_validate(payment)
