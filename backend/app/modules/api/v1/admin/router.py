"""HTTP routes for Admin operations."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.admin.schemas import (
    AdminPlatformStats,
    AdminReportUpdate,
    AdminRideItem,
    AdminRideListResponse,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserStatusUpdate,
    AdminVehicleItem,
    AdminVehicleListResponse,
    AdminVehicleVerificationUpdate,
)
from app.modules.api.v1.admin.service import AdminService
from app.modules.api.v1.auth.dependencies import require_role
from app.modules.api.v1.rides.schemas import RideResponse
from app.modules.api.v1.safety.schemas import (
    IncidentReportListResponse,
    IncidentReportResponse,
)
from app.modules.api.v1.users.models import User
from app.modules.api.v1.users.schemas import UserDetailsResponse
from app.modules.api.v1.vehicles.schemas import VehicleResponse

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


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all registered platform users",
)
async def list_users(
    role: str | None = Query(default=None),
    user_status: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> AdminUserListResponse:
    """Fetch paginated real users for admin management."""
    service = AdminService(session)
    users, total = await service.list_users(
        role=role,
        status=user_status,
        search=search,
        page=page,
        page_size=page_size,
    )
    return AdminUserListResponse(
        items=[AdminUserItem(**u) for u in users],
        total=total,
    )


@router.get(
    "/vehicles",
    response_model=AdminVehicleListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all registered vehicles with verification status",
)
async def list_vehicles(
    vehicle_status: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> AdminVehicleListResponse:
    """Fetch fleet vehicles for admin verification and oversight."""
    service = AdminService(session)
    vehicles, total = await service.list_vehicles(
        status=vehicle_status,
        page=page,
        page_size=page_size,
    )
    return AdminVehicleListResponse(
        items=[AdminVehicleItem(**v) for v in vehicles],
        total=total,
    )


@router.patch(
    "/vehicles/{vehicle_id}/verification",
    response_model=VehicleResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve or reject a vehicle registration",
)
async def verify_vehicle(
    vehicle_id: UUID,
    payload: AdminVehicleVerificationUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> VehicleResponse:
    """Admin approves (verified) or rejects a vehicle."""
    service = AdminService(session)
    vehicle = await service.verify_vehicle(
        vehicle_id=vehicle_id,
        status=payload.verification_status,
        rejected_reason=payload.rejected_reason,
    )
    return VehicleResponse.model_validate(vehicle)


@router.get(
    "/rides",
    response_model=AdminRideListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all published marketplace rides",
)
async def list_rides(
    ride_status: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
) -> AdminRideListResponse:
    """Fetch marketplace rides for admin oversight."""
    service = AdminService(session)
    rides, total = await service.list_rides(
        status=ride_status,
        page=page,
        page_size=page_size,
    )
    return AdminRideListResponse(
        items=[AdminRideItem(**r) for r in rides],
        total=total,
    )


@router.patch(
    "/rides/{ride_id}/cancel",
    response_model=RideResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a ride as platform administrator",
)
async def cancel_ride(
    ride_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> RideResponse:
    """Cancel a ride for safety or compliance violation."""
    service = AdminService(session)
    ride = await service.cancel_ride(ride_id)
    return RideResponse.model_validate(ride)

