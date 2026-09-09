"""Database repository for Admin operations."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.api.v1.admin.schemas import AdminPlatformStats
from app.modules.api.v1.bookings.models import Booking
from app.modules.api.v1.payments.models import Payment
from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.safety.models import IncidentReport
from app.modules.api.v1.users.models import User


class AdminRepository:
    """Encapsulates admin aggregate telemetry and moderation actions."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_reports(
        self,
        status: str | None = None,
        category: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[IncidentReport], int]:
        """Fetch filtered paginated incident reports."""
        filters = []
        if status:
            filters.append(IncidentReport.status == status)
        if category:
            filters.append(IncidentReport.category == category)

        total_stmt = select(func.count(IncidentReport.id)).where(*filters)
        total_res = await self.session.execute(total_stmt)
        total = total_res.scalar_one() or 0

        offset = (page - 1) * page_size
        stmt = (
            select(IncidentReport)
            .where(*filters)
            .order_by(IncidentReport.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

    async def update_report(
        self,
        report_id: UUID,
        status: str,
        admin_notes: str | None,
        admin_id: UUID,
    ) -> IncidentReport | None:
        """Update report status, resolution timestamp, and admin notes."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(IncidentReport)
            .where(IncidentReport.id == report_id)
            .values(
                status=status,
                admin_notes=admin_notes,
                resolved_by=admin_id if status in {"resolved", "dismissed"} else None,
                resolved_at=now if status in {"resolved", "dismissed"} else None,
                updated_at=now,
            )
            .returning(IncidentReport)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def update_user_status(self, user_id: UUID, status: str) -> User | None:
        """Suspend, activate, or deactivate a user account."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(status=status, updated_at=now)
        )
        await self.session.execute(stmt)

        fetch_stmt = (
            select(User)
            .where(User.id == user_id)
            .options(joinedload(User.profile))
        )
        res = await self.session.execute(fetch_stmt)
        return res.scalar_one_or_none()

    async def get_stats(self) -> AdminPlatformStats:
        """Aggregate high-level system KPIs across RIDEX."""
        total_users = (await self.session.execute(select(func.count(User.id)))).scalar_one() or 0
        total_drivers = (
            await self.session.execute(select(func.count(User.id)).where(User.role == "driver"))
        ).scalar_one() or 0
        total_rides = (
            await self.session.execute(select(func.count(Ride.id)).where(Ride.deleted_at.is_(None)))
        ).scalar_one() or 0
        total_bookings = (
            await self.session.execute(select(func.count(Booking.id)))
        ).scalar_one() or 0

        # Payments total succeeded amount
        amt_stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.status == "succeeded"
        )
        total_payments_amount = float((await self.session.execute(amt_stmt)).scalar_one() or 0)

        # Open reports
        open_reports_stmt = select(func.count(IncidentReport.id)).where(
            IncidentReport.status.in_(["pending", "investigating"])
        )
        open_reports_count = (await self.session.execute(open_reports_stmt)).scalar_one() or 0

        return AdminPlatformStats(
            total_users=total_users,
            total_drivers=total_drivers,
            total_rides=total_rides,
            total_bookings=total_bookings,
            total_payments_amount=total_payments_amount,
            open_reports_count=open_reports_count,
        )
