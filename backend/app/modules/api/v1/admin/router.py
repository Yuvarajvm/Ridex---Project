"""HTTP routes for Admin operations."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.admin.schemas import (
    AdminPlatformStats,
    AdminReportUpdate,
    AdminUserStatusUpdate,
)
from app.modules.api.v1.admin.service import AdminService
from app.modules.api.v1.auth.dependencies import require_role
from app.modules.api.v1.safety.schemas import (
    IncidentReportListResponse,
    IncidentReportResponse,
)
from app.modules.api.v1.users.models import User
from app.modules.api.v1.users.schemas import UserDetailsResponse

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get(
    "/stats",
    response_model=AdminPlatformStats,
    status_code=status.HTTP_200_OK,
)
async def get_platform_stats(
    session: AsyncSession = Depends(get_db_session),
) -> AdminPlatformStats:
    """Return platform overview KPIs for admin analytics."""
    service = AdminService(session)
    return await service.get_stats()


@router.get(
    "/reports",
    response_model=IncidentReportListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_incident_reports(
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> IncidentReportListResponse:
    """List and filter all reported platform incidents."""
    service = AdminService(session)
    reports, total = await service.list_reports(
        status=status_filter,
        category=category,
        page=page,
        page_size=page_size,
    )
    return IncidentReportListResponse(
        items=[IncidentReportResponse.model_validate(r) for r in reports],
        total=total,
    )


@router.patch(
    "/reports/{report_id}",
    response_model=IncidentReportResponse,
    status_code=status.HTTP_200_OK,
)
async def update_incident_report(
    report_id: UUID,
    payload: AdminReportUpdate,
    admin_user: User = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_db_session),
) -> IncidentReportResponse:
    """Update report review status or add resolution notes."""
    service = AdminService(session)
    report = await service.update_report(
        report_id=report_id,
        payload=payload,
        admin_id=admin_user.id,
    )
    return IncidentReportResponse.model_validate(report)


@router.patch(
    "/users/{user_id}/status",
    response_model=UserDetailsResponse,
    status_code=status.HTTP_200_OK,
)
async def update_user_status(
    user_id: UUID,
    payload: AdminUserStatusUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> UserDetailsResponse:
    """Suspend or activate a user account."""
    service = AdminService(session)
    user = await service.update_user_status(
        user_id=user_id,
        payload=payload,
    )
    return UserDetailsResponse.model_validate(user)
