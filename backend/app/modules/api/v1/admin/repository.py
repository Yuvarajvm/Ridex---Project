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
from app.modules.api.v1.vehicles.models import Vehicle


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
        """Aggregate high-level system KPIs across RIDEX using optimized SQL."""

        # --- Users ---
        user_stmt = select(
            func.count(User.id).label("total_users"),
            func.count(User.id).filter(User.status == "active").label("active_users"),
            func.count(User.id).filter(User.status == "suspended").label("suspended_users"),
            func.count(User.id).filter(User.role == "driver").label("total_drivers"),
            func.count(User.id).filter(User.role == "rider").label("total_riders"),
        ).where(User.deleted_at.is_(None))
        user_row = (await self.session.execute(user_stmt)).one()

        # --- Vehicles ---
        vehicle_stmt = select(
            func.count(Vehicle.id).label("total_vehicles"),
            func.count(Vehicle.id).filter(Vehicle.verification_status == "verified").label("verified_vehicles"),
            func.count(Vehicle.id).filter(Vehicle.verification_status == "pending").label("pending_vehicles"),
            func.count(Vehicle.id).filter(Vehicle.verification_status == "rejected").label("rejected_vehicles"),
        ).where(Vehicle.deleted_at.is_(None))
        vehicle_row = (await self.session.execute(vehicle_stmt)).one()

        # --- Rides ---
        ride_stmt = select(
            func.count(Ride.id).label("total_rides"),
            func.count(Ride.id).filter(Ride.status == "scheduled").label("scheduled_rides"),
            func.count(Ride.id).filter(Ride.status == "in_progress").label("in_progress_rides"),
            func.count(Ride.id).filter(Ride.status == "completed").label("completed_rides"),
            func.count(Ride.id).filter(Ride.status == "cancelled").label("cancelled_rides"),
        ).where(Ride.deleted_at.is_(None))
        ride_row = (await self.session.execute(ride_stmt)).one()

        # --- Bookings ---
        booking_stmt = select(
            func.count(Booking.id).label("total_bookings"),
            func.count(Booking.id).filter(Booking.status == "confirmed").label("confirmed_bookings"),
            func.count(Booking.id).filter(Booking.status == "completed").label("completed_bookings"),
            func.count(Booking.id).filter(Booking.status == "cancelled").label("cancelled_bookings"),
            func.count(Booking.id).filter(Booking.status == "rejected").label("rejected_bookings"),
        )
        booking_row = (await self.session.execute(booking_stmt)).one()

        # --- Payments ---
        payment_stmt = select(
            func.count(Payment.id).label("total_transactions"),
            func.count(Payment.id).filter(Payment.status == "succeeded").label("succeeded_payments"),
            func.count(Payment.id).filter(Payment.status == "failed").label("failed_payments"),
            func.count(Payment.id).filter(Payment.status == "refunded").label("refunded_payments"),
            func.coalesce(
                func.sum(Payment.amount).filter(Payment.status == "succeeded"),
                0,
            ).label("total_revenue"),
        )
        payment_row = (await self.session.execute(payment_stmt)).one()

        # --- Safety ---
        safety_stmt = select(
            func.count(IncidentReport.id).label("total_reports"),
            func.count(IncidentReport.id).filter(
                IncidentReport.status.in_(["pending", "investigating"])
            ).label("open_reports"),
            func.count(IncidentReport.id).filter(IncidentReport.status == "resolved").label("resolved_reports"),
            func.count(IncidentReport.id).filter(IncidentReport.status == "dismissed").label("dismissed_reports"),
        )
        safety_row = (await self.session.execute(safety_stmt)).one()

        return AdminPlatformStats(
            total_users=user_row.total_users,
            active_users=user_row.active_users,
            suspended_users=user_row.suspended_users,
            total_drivers=user_row.total_drivers,
            total_riders=user_row.total_riders,
            total_vehicles=vehicle_row.total_vehicles,
            verified_vehicles=vehicle_row.verified_vehicles,
            pending_vehicles=vehicle_row.pending_vehicles,
            rejected_vehicles=vehicle_row.rejected_vehicles,
            total_rides=ride_row.total_rides,
            scheduled_rides=ride_row.scheduled_rides,
            in_progress_rides=ride_row.in_progress_rides,
            completed_rides=ride_row.completed_rides,
            cancelled_rides=ride_row.cancelled_rides,
            total_bookings=booking_row.total_bookings,
            confirmed_bookings=booking_row.confirmed_bookings,
            completed_bookings=booking_row.completed_bookings,
            cancelled_bookings=booking_row.cancelled_bookings,
            rejected_bookings=booking_row.rejected_bookings,
            total_transactions=payment_row.total_transactions,
            succeeded_payments=payment_row.succeeded_payments,
            failed_payments=payment_row.failed_payments,
            refunded_payments=payment_row.refunded_payments,
            total_revenue=float(payment_row.total_revenue),
            total_payments_amount=float(payment_row.total_revenue),
            total_reports=safety_row.total_reports,
            open_reports=safety_row.open_reports,
            open_reports_count=safety_row.open_reports,
            resolved_reports=safety_row.resolved_reports,
            dismissed_reports=safety_row.dismissed_reports,
        )

    async def list_vehicles(
        self,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        filters = [Vehicle.deleted_at.is_(None)]
        if status and status != "all":
            filters.append(Vehicle.verification_status == status)

        count_stmt = select(func.count(Vehicle.id)).where(*filters)
        total = (await self.session.execute(count_stmt)).scalar_one()

        offset = (page - 1) * page_size
        stmt = (
            select(Vehicle, User.email.label("owner_email"))
            .join(User, Vehicle.owner_id == User.id)
            .where(*filters)
            .order_by(Vehicle.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        res = await self.session.execute(stmt)
        items = []
        for vehicle, owner_email in res.all():
            items.append({
                "id": vehicle.id,
                "owner_id": vehicle.owner_id,
                "owner_email": owner_email,
                "make": vehicle.make,
                "model": vehicle.model,
                "year": vehicle.manufacture_year,
                "color": vehicle.color,
                "registration_number": vehicle.registration_number,
                "vehicle_type": vehicle.vehicle_type,
                "seat_capacity": vehicle.seat_capacity,
                "verification_status": vehicle.verification_status,
                "created_at": vehicle.created_at.isoformat(),
                "verified_at": vehicle.verified_at.isoformat() if vehicle.verified_at else None,
                "rejected_reason": vehicle.rejected_reason,
            })
        return items, total

    async def verify_vehicle(
        self,
        vehicle_id: UUID,
        status: str,
        rejected_reason: str | None = None,
    ) -> Vehicle | None:
        now = datetime.now(timezone.utc)
        values: dict = {
            "verification_status": status,
            "updated_at": now,
        }
        if status == "verified":
            values["verified_at"] = now
            values["rejected_reason"] = None
        elif status == "rejected":
            values["verified_at"] = None
            values["rejected_reason"] = rejected_reason or "Rejected by administrator"

        stmt = (
            update(Vehicle)
            .where(Vehicle.id == vehicle_id, Vehicle.deleted_at.is_(None))
            .values(**values)
            .returning(Vehicle)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_users(
        self,
        role: str | None = None,
        status: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        filters = [User.deleted_at.is_(None)]
        if role and role != "all":
            filters.append(User.role == role)
        if status and status != "all":
            filters.append(User.status == status)
        if search:
            filters.append(User.email.ilike(f"%{search}%"))

        count_stmt = select(func.count(User.id)).where(*filters)
        total = (await self.session.execute(count_stmt)).scalar_one()

        offset = (page - 1) * page_size
        stmt = (
            select(User)
            .options(joinedload(User.profile))
            .where(*filters)
            .order_by(User.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        res = await self.session.execute(stmt)
        users = res.scalars().unique().all()
        items = []
        for u in users:
            items.append({
                "id": u.id,
                "email": u.email,
                "phone_number": u.phone_number,
                "role": u.role,
                "status": u.status,
                "first_name": u.profile.first_name if u.profile else None,
                "last_name": u.profile.last_name if u.profile else None,
                "created_at": u.created_at.isoformat(),
            })
        return items, total

    async def list_rides(
        self,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        filters = [Ride.deleted_at.is_(None)]
        if status and status != "all":
            filters.append(Ride.status == status)

        count_stmt = select(func.count(Ride.id)).where(*filters)
        total = (await self.session.execute(count_stmt)).scalar_one()

        offset = (page - 1) * page_size
        stmt = (
            select(Ride, User.email.label("driver_email"))
            .join(User, Ride.driver_id == User.id)
            .where(*filters)
            .order_by(Ride.departure_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        res = await self.session.execute(stmt)
        items = []
        for ride, driver_email in res.all():
            items.append({
                "id": ride.id,
                "driver_id": ride.driver_id,
                "driver_email": driver_email,
                "origin": ride.origin,
                "destination": ride.destination,
                "departure_time": ride.departure_at.isoformat(),
                "available_seats": ride.available_seats,
                "price_per_seat": float(ride.price_per_seat),
                "status": ride.status,
                "is_women_only": ride.is_women_only,
                "created_at": ride.created_at.isoformat(),
            })
        return items, total

    async def cancel_ride(self, ride_id: UUID) -> Ride | None:
        now = datetime.now(timezone.utc)
        stmt = (
            update(Ride)
            .where(Ride.id == ride_id, Ride.deleted_at.is_(None))
            .values(status="cancelled", updated_at=now)
            .returning(Ride)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

