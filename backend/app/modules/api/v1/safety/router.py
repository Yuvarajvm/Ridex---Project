"""HTTP routes for the Safety module."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.safety.schemas import (
    IncidentReportCreate,
    IncidentReportListResponse,
    IncidentReportResponse,
)
from app.modules.api.v1.safety.service import SafetyService
from app.modules.api.v1.users.models import User

router = APIRouter(prefix="/safety", tags=["Safety"])


@router.post(
    "/reports",
    response_model=IncidentReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_incident_report(
    payload: IncidentReportCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> IncidentReportResponse:
    """Submit a safety, conduct, or trip issue report."""
    service = SafetyService(session)
    report = await service.submit_report(
        reporter_id=current_user.id,
        payload=payload,
    )
    return IncidentReportResponse.model_validate(report)


@router.get(
    "/reports/my",
    response_model=IncidentReportListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_my_reports(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> IncidentReportListResponse:
    """List incident reports filed by current user."""
    service = SafetyService(session)
    reports, total = await service.list_my_reports(reporter_id=current_user.id)
    return IncidentReportListResponse(
        items=[IncidentReportResponse.model_validate(r) for r in reports],
        total=total,
    )
