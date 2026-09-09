"""Database access layer for RIDEX payments."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.payments.models import Payment


class PaymentRepository:
    """Encapsulates database operations for payments."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, payment: Payment) -> Payment:
        """Persist a new payment record."""
        self.session.add(payment)
        await self.session.flush()
        await self.session.refresh(payment)
        return payment

    async def get_by_id(self, payment_id: UUID) -> Payment | None:
        """Fetch payment by ID."""
        statement = select(Payment).where(
            Payment.id == payment_id,
            Payment.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_booking_id(self, booking_id: UUID) -> Payment | None:
        """Fetch payment for a booking."""
        statement = (
            select(Payment)
            .where(
                Payment.booking_id == booking_id,
                Payment.deleted_at.is_(None),
            )
            .order_by(Payment.created_at.desc())
        )
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def list_by_payer(
        self,
        payer_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Payment], int]:
        """Return paginated payments for a user."""
        offset = (page - 1) * page_size

        statement = (
            select(Payment)
            .where(
                Payment.payer_id == payer_id,
                Payment.deleted_at.is_(None),
            )
            .order_by(Payment.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        count_statement = select(func.count(Payment.id)).where(
            Payment.payer_id == payer_id,
            Payment.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)
        total_result = await self.session.execute(count_statement)

        payments = list(result.scalars().all())
        total = total_result.scalar_one()

        return payments, total
