"""Application service for platform administration."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.api.v1.admin.repository import AdminRepository
from app.modules.api.v1.admin.schemas import (
    AdminPlatformStats,
    AdminReportUpdate,
    AdminUserStatusUpdate,
)
from app.modules.api.v1.safety.models import IncidentReport
from app.modules.api.v1.users.models import User


class AdminService:
    """Service handling moderation actions and platform KPIs."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = AdminRepository(session)

    async def list_reports(
        self,
        status: str | None = None,
        category: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[IncidentReport], int]:
        """Fetch filtered incident reports."""
        return await self.repository.list_reports(
            status=status,
            category=category,
            page=page,
            page_size=page_size,
        )

    async def update_report(
        self,
        report_id: UUID,
        payload: AdminReportUpdate,
        admin_id: UUID,
    ) -> IncidentReport:
        """Update report status and resolution notes."""
        updated = await self.repository.update_report(
            report_id=report_id,
            status=payload.status,
            admin_notes=payload.admin_notes,
            admin_id=admin_id,
        )
        if updated is None:
            raise NotFoundError("Incident report not found.")

        await self.session.commit()
        await self.session.refresh(updated)
        return updated

    async def update_user_status(
        self,
        user_id: UUID,
        payload: AdminUserStatusUpdate,
    ) -> User:
        """Suspend, activate, or update user account status."""
        user = await self.repository.update_user_status(
            user_id=user_id,
            status=payload.status,
        )
        if user is None:
            raise NotFoundError("User not found.")

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_stats(self) -> AdminPlatformStats:
        """Retrieve aggregated platform stats."""
        return await self.repository.get_stats()
