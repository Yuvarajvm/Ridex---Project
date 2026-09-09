"""Application service for safety incident reporting."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.api.v1.safety.models import IncidentReport
from app.modules.api.v1.safety.repository import IncidentReportRepository
from app.modules.api.v1.safety.schemas import IncidentReportCreate


class SafetyService:
    """Service handling incident reports submission and user queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = IncidentReportRepository(session)

    async def submit_report(
        self,
        reporter_id: UUID,
        payload: IncidentReportCreate,
    ) -> IncidentReport:
        """Create and persist an incident report."""
        report = IncidentReport(
            reporter_id=reporter_id,
            reported_user_id=payload.reported_user_id,
            ride_id=payload.ride_id,
            category=payload.category.strip().lower(),
            description=payload.description.strip(),
            status="pending",
        )
        created = await self.repository.create(report)
        await self.session.commit()
        await self.session.refresh(created)
        return created

    async def list_my_reports(
        self,
        reporter_id: UUID,
    ) -> tuple[list[IncidentReport], int]:
        """Fetch all reports submitted by the given user."""
        return await self.repository.list_by_reporter(reporter_id)
