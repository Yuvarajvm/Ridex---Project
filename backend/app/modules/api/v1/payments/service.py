"""Business logic for RIDEX payment processing and gateway abstraction."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
)
from app.modules.api.v1.bookings.repository import BookingRepository
from app.modules.api.v1.notifications.models import Notification
from app.modules.api.v1.payments.models import Payment
from app.modules.api.v1.payments.providers.base import PaymentProvider
from app.modules.api.v1.payments.providers.mock_provider import MockPaymentProvider
from app.modules.api.v1.payments.repository import PaymentRepository
from app.modules.api.v1.payments.schemas import (
    PaymentIntentRequest,
    PaymentIntentResponse,
    ProcessPaymentRequest,
)


class PaymentService:
    """Application service for handling payment intents and settlement."""

    def __init__(
        self,
        session: AsyncSession,
        provider: PaymentProvider | None = None,
    ) -> None:
        self.session = session
        self.repository = PaymentRepository(session)
        self.booking_repository = BookingRepository(session)
        if provider:
            self.provider = provider
        else:
            import os
            from app.core.config import get_settings
            settings = get_settings()
            provider_type = os.environ.get("RIDEX_PAYMENT_PROVIDER", "development").lower()
            if provider_type == "production" or settings.is_production:
                from app.modules.api.v1.payments.providers.production_provider import ProductionPaymentProvider
                self.provider = ProductionPaymentProvider()
            else:
                self.provider = MockPaymentProvider()

    async def create_payment_intent(
        self,
        user_id: UUID,
        payload: PaymentIntentRequest,
    ) -> PaymentIntentResponse:
        """Create a payment intent for an existing confirmed booking."""
        booking = await self.booking_repository.get_by_id(payload.booking_id)
        if booking is None:
            raise NotFoundError("Booking not found.")

        if booking.rider_id != user_id:
            raise AuthorizationError("You can only pay for your own booking.")

        if booking.status in {"cancelled", "rejected"}:
            raise ConflictError(f"Cannot pay for a booking that is {booking.status}.")

        # Check existing payment
        existing = await self.repository.get_by_booking_id(booking.id)
        if existing is not None:
            if existing.status == "succeeded":
                raise ConflictError("Payment has already been completed for this booking.")
            if existing.status == "pending":
                return PaymentIntentResponse(
                    payment_id=existing.id,
                    booking_id=booking.id,
                    amount=existing.amount,
                    currency=existing.currency,
                    status=existing.status,
                    provider=existing.provider,
                    provider_order_id=existing.provider_order_id,
                    client_secret=f"sec_mock_{str(booking.id).replace('-', '')[:16]}",
                )

        # Call payment gateway provider to create order
        order_meta = await self.provider.create_order(
            amount=booking.total_fare,
            currency="INR",
            reference_id=str(booking.id),
        )

        payment = Payment(
            booking_id=booking.id,
            payer_id=user_id,
            amount=booking.total_fare,
            currency="INR",
            provider="mock",
            provider_order_id=order_meta.get("order_id"),
            status="pending",
        )

        created = await self.repository.create(payment)
        await self.session.commit()
        await self.session.refresh(created)

        return PaymentIntentResponse(
            payment_id=created.id,
            booking_id=booking.id,
            amount=created.amount,
            currency=created.currency,
            status=created.status,
            provider=created.provider,
            provider_order_id=created.provider_order_id,
            client_secret=order_meta.get("client_secret"),
        )

    async def process_payment(
        self,
        user_id: UUID,
        payload: ProcessPaymentRequest,
    ) -> Payment:
        """Process and capture authorization for a payment intent."""
        payment = await self.repository.get_by_id(payload.payment_id)
        if payment is None:
            raise NotFoundError("Payment record not found.")

        if payment.payer_id != user_id:
            raise AuthorizationError("You cannot process payments for another user.")

        if payment.status == "succeeded":
            return payment

        # Verify and capture with the provider
        result = await self.provider.verify_and_capture(
            payment_id=str(payment.id),
            order_id=payment.provider_order_id or "unknown",
            simulate_failure=payload.simulate_failure,
            payment_method=payload.payment_method,
        )

        if result.get("success"):
            payment.status = "succeeded"
            payment.provider_payment_id = result.get("provider_payment_id")
            payment.error_message = None

            # Notify rider and driver
            booking = await self.booking_repository.get_by_id(payment.booking_id)
            if booking:
                rider_notif = Notification(
                    user_id=booking.rider_id,
                    type="payment_succeeded",
                    title="Payment Successful",
                    message=f"Payment of ₹{float(payment.amount):.0f} was confirmed.",
                    data={"booking_id": str(booking.id), "payment_id": str(payment.id)},
                    is_read=False,
                )
                self.session.add(rider_notif)
                if booking.ride:
                    driver_notif = Notification(
                        user_id=booking.ride.driver_id,
                        type="payment_received",
                        title="Payment Received",
                        message=f"Passenger payment of ₹{float(payment.amount):.0f} received.",
                        data={"booking_id": str(booking.id), "payment_id": str(payment.id)},
                        is_read=False,
                    )
                    self.session.add(driver_notif)
        else:
            payment.status = "failed"
            payment.error_message = result.get("error", "Payment processing failed.")

        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def get_payment(
        self,
        payment_id: UUID,
        user_id: UUID,
    ) -> Payment:
        """Retrieve payment record."""
        payment = await self.repository.get_by_id(payment_id)
        if payment is None:
            raise NotFoundError("Payment not found.")

        if payment.payer_id != user_id:
            raise AuthorizationError("Unauthorized access to payment record.")

        return payment

    async def get_payment_by_booking(
        self,
        booking_id: UUID,
        user_id: UUID,
    ) -> Payment:
        """Retrieve payment for booking."""
        payment = await self.repository.get_by_booking_id(booking_id)
        if payment is None:
            raise NotFoundError("Payment not found for this booking.")

        if payment.payer_id != user_id:
            raise AuthorizationError("Unauthorized access to payment record.")

        return payment

    async def list_my_payments(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Payment], int]:
        """List payments for user."""
        return await self.repository.list_by_payer(
            user_id,
            page=page,
            page_size=page_size,
        )
