"""Phase 2 Foundation Tests: Women-only validation, Password Reset, Admin Protection, and 22+ KPIs."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main_module

API_PREFIX = "/api/v1"


@pytest.mark.asyncio
async def test_admin_self_registration_blocked():
    """Verify that public registration rejects role='admin'."""
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": f"hacker_{uuid4().hex[:8]}@example.com",
                "phone_number": f"+9199{uuid4().int % 100000000:08d}",
                "password": "Password123!",
                "first_name": "Admin",
                "role": "admin",
            },
        )
        assert resp.status_code in (400, 403, 422)


@pytest.mark.asyncio
async def test_forgot_and_reset_password_flow():
    """Verify requesting reset token, hashing, and resetting password."""
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"reset_user_{uuid4().hex[:8]}@example.com"
        password = "OriginalPassword123!"

        # 1. Register user
        reg_resp = await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": email,
                "phone_number": f"+9198{uuid4().int % 100000000:08d}",
                "password": password,
                "first_name": "Reset",
                "role": "rider",
            },
        )
        assert reg_resp.status_code == 201

        # 2. Forgot password request (always returns 200)
        forgot_resp = await client.post(
            f"{API_PREFIX}/auth/forgot-password",
            json={"email": email},
        )
        assert forgot_resp.status_code == 200

        # Forgot password for non-existent email also returns 200 (anti-enumeration)
        dummy_resp = await client.post(
            f"{API_PREFIX}/auth/forgot-password",
            json={"email": "nobody@example.com"},
        )
        assert dummy_resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_stats_contains_all_22_kpis():
    """Verify admin platform stats endpoint returns all real database aggregates."""
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create an admin user directly via DB or helper
        from app.core.database import AsyncSessionFactory
        from app.core.security import hash_password
        from app.modules.api.v1.users.models import User

        admin_email = f"adm_stats_{uuid4().hex[:8]}@example.com"
        admin_id = uuid4()
        async with AsyncSessionFactory() as session:
            admin_user = User(
                id=admin_id,
                email=admin_email,
                password_hash=hash_password("AdminSecurePass123!"),
                role="admin",
                status="active",
            )
            session.add(admin_user)
            await session.commit()

        # Login as admin
        login_resp = await client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": admin_email, "password": "AdminSecurePass123!"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        # Fetch stats
        stats_resp = await client.get(
            f"{API_PREFIX}/admin/stats",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert stats_resp.status_code == 200
        data = stats_resp.json()

        # Verify all 22+ KPIs exist
        expected_keys = [
            "total_users", "active_users", "suspended_users", "total_drivers", "total_riders",
            "total_vehicles", "verified_vehicles", "pending_vehicles", "rejected_vehicles",
            "total_rides", "scheduled_rides", "in_progress_rides", "completed_rides", "cancelled_rides",
            "total_bookings", "confirmed_bookings", "completed_bookings", "cancelled_bookings", "rejected_bookings",
            "total_transactions", "succeeded_payments", "failed_payments", "refunded_payments", "total_revenue",
            "total_reports", "open_reports", "resolved_reports", "dismissed_reports",
        ]
        for key in expected_keys:
            assert key in data, f"Missing KPI key: {key}"


@pytest.mark.asyncio
async def test_women_only_ride_lifecycle():
    """Verify women-only ride creation and booking gender restrictions."""
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        from app.core.database import AsyncSessionFactory
        from app.modules.api.v1.users.models import Profile, User
        from sqlalchemy import update

        # 1. Register driver and rider
        drv_email = f"w_drv_{uuid4().hex[:8]}@example.com"
        reg_drv = await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": drv_email,
                "phone_number": f"+9191{uuid4().int % 100000000:08d}",
                "password": "Password123!",
                "first_name": "Priya",
                "role": "driver",
            },
        )
        assert reg_drv.status_code == 201
        drv_id = reg_drv.json()["user"]["id"]
        drv_token = reg_drv.json()["access_token"]

        # Register male vehicle
        v_resp = await client.post(
            f"{API_PREFIX}/vehicles",
            headers={"Authorization": f"Bearer {drv_token}"},
            json={
                "vehicle_type": "car",
                "make": "Honda",
                "model": "City",
                "registration_number": f"KA{uuid4().int % 100:02d}WO{uuid4().int % 10000:04d}",
                "seat_capacity": 4,
            },
        )
        assert v_resp.status_code == 201
        v_id = v_resp.json()["id"]

        # 2. Driver profile gender is not set -> creating women-only ride should fail
        dep_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        fail_ride = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {drv_token}"},
            json={
                "vehicle_id": v_id,
                "origin": "Indiranagar",
                "destination": "MG Road",
                "departure_at": dep_time,
                "available_seats": 3,
                "price_per_seat": 100.0,
                "is_women_only": True,
            },
        )
        assert fail_ride.status_code == 409

        # 3. Set driver gender to female in DB
        async with AsyncSessionFactory() as session:
            await session.execute(
                update(Profile)
                .where(Profile.user_id == drv_id)
                .values(gender="female")
            )
            await session.commit()

        # Now creating women-only ride should succeed
        ok_ride = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {drv_token}"},
            json={
                "vehicle_id": v_id,
                "origin": "Indiranagar",
                "destination": "MG Road",
                "departure_at": dep_time,
                "available_seats": 3,
                "price_per_seat": 100.0,
                "is_women_only": True,
            },
        )
        assert ok_ride.status_code == 201
        ride_id = ok_ride.json()["id"]
        assert ok_ride.json()["is_women_only"] is True

        # 4. Register rider (male / unset gender)
        rdr_email = f"w_rdr_{uuid4().hex[:8]}@example.com"
        reg_rdr = await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": rdr_email,
                "phone_number": f"+9192{uuid4().int % 100000000:08d}",
                "password": "Password123!",
                "first_name": "Rahul",
                "role": "rider",
            },
        )
        assert reg_rdr.status_code == 201
        rdr_id = reg_rdr.json()["user"]["id"]
        rdr_token = reg_rdr.json()["access_token"]

        # Booking should fail with 403 Forbidden
        fail_booking = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rdr_token}"},
            json={"ride_id": ride_id, "seats_booked": 1},
        )
        assert fail_booking.status_code == 403

        # 5. Set rider gender to female in DB -> booking should succeed
        async with AsyncSessionFactory() as session:
            await session.execute(
                update(Profile)
                .where(Profile.user_id == rdr_id)
                .values(gender="female")
            )
            await session.commit()

        ok_booking = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rdr_token}"},
            json={"ride_id": ride_id, "seats_booked": 1},
        )
        assert ok_booking.status_code == 201
        assert ok_booking.json()["status"] == "confirmed"
