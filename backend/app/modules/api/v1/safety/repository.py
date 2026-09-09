"""Database repository for safety and incident reports."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.safety.models import IncidentReport


class IncidentReportRepository:
    """Encapsulates database access for incident reports."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, report: IncidentReport) -> IncidentReport:
        """Persist a new incident report."""
        self.session.add(report)
        await self.session.flush()
        return report

    async def get_by_id(self, report_id: UUID) -> IncidentReport | None:
        """Fetch report by primary key."""
        stmt = select(IncidentReport).where(IncidentReport.id == report_id)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_reporter(self, reporter_id: UUID) -> tuple[list[IncidentReport], int]:
        """Fetch reports created by a specific user."""
        total_stmt = select(func.count(IncidentReport.id)).where(IncidentReport.reporter_id == reporter_id)
        total_res = await self.session.execute(total_stmt)
        total = total_res.scalar_one() or 0

        stmt = (
            select(IncidentReport)
            .where(IncidentReport.reporter_id == reporter_id)
            .order_by(IncidentReport.created_at.desc())
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total
