"""Live End-to-End Persona Verification and Failure Path Testing.

Executes real HTTP requests against the live server (http://127.0.0.1:8000)
simulating the full Driver, Rider, and Admin personas and failure paths.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
import app.shared.models

BASE_URL = "http://127.0.0.1:8000/api/v1"


@pytest.mark.asyncio
async def test_live_full_e2e_driver_rider_admin_and_failure_paths():
    """Executes live end-to-end flow with separate Driver, Rider, and Admin personas."""
    try:
        async with httpx.AsyncClient(timeout=1.0) as probe:
            await probe.get("http://127.0.0.1:8000/api/v1/health")
    except Exception:
        pytest.skip("Live server not running at http://127.0.0.1:8000")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # ==========================================
        # 1. FAILURE PATH TESTING
        # ==========================================
        # Invalid login
        bad_login = await client.post(
            "/auth/login",
            json={"email": "wrong_user@example.com", "password": "WrongPassword123!"},
        )
        assert bad_login.status_code == 401
        assert "invalid" in bad_login.json()["detail"].lower()

        # Unauthenticated access
        unauth = await client.get("/users/me")
        assert unauth.status_code == 401

        # ==========================================
        # 2. DRIVER JOURNEY
        # ==========================================
        d_email = f"live_driver_{uuid4().hex[:8]}@example.com"
        d_phone = f"+9198{uuid4().int % 100000000:08d}"
        d_pass = "SecureDriverPass123!"

        # Register Driver
        d_reg = await client.post(
            "/auth/register",
            json={
                "email": d_email,
                "phone_number": d_phone,
                "password": d_pass,
                "first_name": "Aditya",
                "last_name": "Verma",
                "role": "driver",
            },
        )
        assert d_reg.status_code == 201

        # Duplicate registration failure path
        dup_reg = await client.post(
            "/auth/register",
            json={
                "email": d_email,
                "phone_number": d_phone,
                "password": d_pass,
                "first_name": "Aditya",
                "role": "driver",
            },
        )
        assert dup_reg.status_code == 409

        # Login Driver
        d_login = await client.post(
            "/auth/login",
            json={"email": d_email, "password": d_pass},
        )
        assert d_login.status_code == 200
        driver_token = d_login.json()["access_token"]
        driver_id = d_login.json()["user"]["id"]
        d_headers = {"Authorization": f"Bearer {driver_token}"}

        # Add Vehicle
        v_resp = await client.post(
            "/vehicles",
            headers=d_headers,
            json={
                "vehicle_type": "car",
                "make": "Maruti",
                "model": "Brezza",
                "registration_number": f"KA{uuid4().int % 100:02d}LV{uuid4().int % 10000:04d}",
                "seat_capacity": 4,
            },
        )
        assert v_resp.status_code == 201
        vehicle_id = v_resp.json()["id"]

        # Offer Ride
        dep_time = datetime.now(timezone.utc) + timedelta(days=3)
        origin_city = f"Bengaluru_{uuid4().hex[:4]}"
        dest_city = f"Mysuru_{uuid4().hex[:4]}"

        r_resp = await client.post(
            "/rides",
            headers=d_headers,
            json={
                "vehicle_id": vehicle_id,
                "origin": origin_city,
                "destination": dest_city,
                "departure_at": dep_time.isoformat(),
                "available_seats": 3,
                "price_per_seat": 250.0,
                "notes": "Comfortable AC ride",
            },
        )
        assert r_resp.status_code == 201
        ride_id = r_resp.json()["id"]

        # ==========================================
        # 3. RIDER JOURNEY
        # ==========================================
        r_email = f"live_rider_{uuid4().hex[:8]}@example.com"
        r_phone = f"+9199{uuid4().int % 100000000:08d}"
        r_pass = "SecureRiderPass123!"

        r_reg = await client.post(
            "/auth/register",
            json={
                "email": r_email,
                "phone_number": r_phone,
                "password": r_pass,
                "first_name": "Sneha",
                "last_name": "Patil",
                "role": "rider",
            },
        )
        assert r_reg.status_code == 201

        r_login = await client.post(
            "/auth/login",
            json={"email": r_email, "password": r_pass},
        )
        assert r_login.status_code == 200
        rider_token = r_login.json()["access_token"]
        rider_id = r_login.json()["user"]["id"]
        r_headers = {"Authorization": f"Bearer {rider_token}"}

        # Search Marketplace
        search_resp = await client.get(f"/rides?origin={origin_city}")
        assert search_resp.status_code == 200
        items = search_resp.json()["items"]
        assert len(items) == 1
        assert items[0]["id"] == ride_id

        # Book 1 Seat
        b_resp = await client.post(
            "/bookings",
            headers=r_headers,
            json={"ride_id": ride_id, "seats_booked": 1},
        )
        assert b_resp.status_code == 201
        booking = b_resp.json()
        booking_id = booking["id"]
        assert booking["status"] == "confirmed"
        assert booking["total_fare"] == "250.00"

        # Create Payment Intent
        intent_resp = await client.post(
            "/payments/create-intent",
            headers=r_headers,
            json={"booking_id": booking_id},
        )
        assert intent_resp.status_code == 201
        payment_id = intent_resp.json()["payment_id"]

        # Process Payment
        pay_resp = await client.post(
            "/payments/process",
            headers=r_headers,
            json={
                "payment_id": payment_id,
                "payment_method": "upi",
                "simulate_failure": False,
            },
        )
        assert pay_resp.status_code == 200
        assert pay_resp.json()["status"] == "succeeded"

        # Check My Bookings
        my_b = await client.get("/bookings/my", headers=r_headers)
        assert my_b.status_code == 200
        assert len(my_b.json()["items"]) >= 1
        assert any(b["id"] == booking_id for b in my_b.json()["items"])

        # In-Trip Chat
        chat_msg = await client.post(
            f"/rides/{ride_id}/messages",
            headers=r_headers,
            json={"content": "Hello Driver, see you at the pickup point!"},
        )
        assert chat_msg.status_code == 201

        # Driver completes ride
        complete_ride = await client.patch(
            f"/rides/{ride_id}/status",
            headers=d_headers,
            json={"status": "completed"},
        )
        assert complete_ride.status_code == 200
        assert complete_ride.json()["status"] == "completed"

        # Rider leaves verified review
        rev_resp = await client.post(
            "/reviews",
            headers=r_headers,
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 5,
                "comment": "Punctual, safe driving, very comfortable.",
            },
        )
        assert rev_resp.status_code == 201

        # ==========================================
        # 4. ADMIN JOURNEY & PROTECTION
        # ==========================================
        # Rider cannot access admin routes
        admin_blocked = await client.get("/admin/stats", headers=r_headers)
        assert admin_blocked.status_code == 403

        # Promote a dedicated admin
        from uuid import UUID
        from sqlalchemy import update
        from app.core.database import AsyncSessionFactory
        from app.modules.api.v1.users.models import User

        adm_email = f"live_admin_{uuid4().hex[:8]}@example.com"
        await client.post(
            "/auth/register",
            json={
                "email": adm_email,
                "password": "SecureAdminPassword123!",
                "first_name": "Chief",
                "last_name": "Admin",
                "role": "rider",
            },
        )
        async with AsyncSessionFactory() as session:
            await session.execute(
                update(User).where(User.email == adm_email).values(role="admin")
            )
            await session.commit()

        adm_login = await client.post(
            "/auth/login",
            json={"email": adm_email, "password": "SecureAdminPassword123!"},
        )
        admin_token = adm_login.json()["access_token"]
        admin_id = adm_login.json()["user"]["id"]
        adm_headers = {"Authorization": f"Bearer {admin_token}"}

        # Admin accesses stats
        adm_stats = await client.get("/admin/stats", headers=adm_headers)
        assert adm_stats.status_code == 200
        assert "total_users" in adm_stats.json()
        assert "total_rides" in adm_stats.json()

        # Rider files incident report
        report_resp = await client.post(
            "/safety/reports",
            headers=r_headers,
            json={
                "category": "app_issue",
                "description": "Payment receipt download icon had minor delay.",
                "ride_id": ride_id,
            },
        )
        assert report_resp.status_code == 201
        rep_id = report_resp.json()["id"]

        # Admin resolves report
        adm_resolve = await client.patch(
            f"/admin/reports/{rep_id}",
            headers=adm_headers,
            json={
                "status": "resolved",
                "admin_notes": "Receipt caching optimized, confirmed working.",
            },
        )
        assert adm_resolve.status_code == 200
        assert adm_resolve.json()["status"] == "resolved"
        assert adm_resolve.json()["resolved_by"] == admin_id
