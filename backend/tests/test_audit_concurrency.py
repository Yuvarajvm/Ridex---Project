"""Phase 8: Concurrency Audit for RIDEX Booking Domain.

Empirically verifies PostgreSQL 'SELECT ... FOR UPDATE' row-level locking
under race conditions (10 concurrent riders competing for 3 available seats).
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import app.main as main_module

API_PREFIX = "/api/v1"


async def register_and_login(client: AsyncClient, prefix: str, role: str = "rider") -> tuple[str, str]:
    """Helper to register and login a user."""
    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    phone = f"+9198{uuid4().int % 100000000:08d}"
    password = "SecurePassword123!"

    reg = await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": email,
            "phone_number": phone,
            "password": password,
            "first_name": "Concurrent",
            "last_name": prefix.capitalize(),
            "role": role,
        },
    )
    assert reg.status_code == 201, f"Failed to register {email}: {reg.text}"
    user_id = reg.json()["user"]["id"]

    login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return token, user_id


@pytest.mark.asyncio
async def test_booking_concurrency_race_condition_pessimistic_lock():
    """Phase 8 Verification: 10 concurrent riders requesting 1 seat on a 3-seat ride.

    Expected:
      - Exactly 3 successful bookings (HTTP 201)
      - Exactly 7 rejected bookings (HTTP 409 Conflict)
      - Ride available_seats == 0 (no negative seats, no overbooking)
    """
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as setup_client:
        # 1. Driver creates vehicle and ride with 3 seats
        driver_token, driver_id = await register_and_login(setup_client, "condrv", role="driver")
        reg_num = f"KA{uuid4().int % 100:02d}CC{uuid4().int % 10000:04d}"

        v_resp = await setup_client.post(
            f"{API_PREFIX}/vehicles",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_type": "car",
                "make": "Toyota",
                "model": "Innova",
                "registration_number": reg_num,
                "seat_capacity": 4,
            },
        )
        assert v_resp.status_code == 201
        vehicle_id = v_resp.json()["id"]

        dep_time = datetime.now(timezone.utc) + timedelta(days=5)
        r_resp = await setup_client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_id": vehicle_id,
                "origin": f"ConOrigin_{uuid4().hex[:4]}",
                "destination": f"ConDest_{uuid4().hex[:4]}",
                "departure_at": dep_time.isoformat(),
                "available_seats": 3,
                "price_per_seat": 250.0,
            },
        )
        assert r_resp.status_code == 201
        ride = r_resp.json()
        ride_id = ride["id"]
        assert ride["available_seats"] == 3

        # 2. Provision 10 distinct rider accounts
        rider_tokens = []
        for i in range(10):
            token, _ = await register_and_login(setup_client, f"conrdr_{i}", role="rider")
            rider_tokens.append(token)

    # 3. Fire 10 simultaneous booking requests concurrently using individual clients
    async def make_booking(token: str):
        async with AsyncClient(
            transport=ASGITransport(app=main_module.app),
            base_url="http://test",
        ) as client:
            return await client.post(
                f"{API_PREFIX}/bookings",
                headers={"Authorization": f"Bearer {token}"},
                json={"ride_id": ride_id, "seats_booked": 1},
            )

    responses = await asyncio.gather(*[make_booking(token) for token in rider_tokens])

    # 4. Assert exact concurrency distribution
    status_codes = [resp.status_code for resp in responses]
    success_count = status_codes.count(201)
    conflict_count = status_codes.count(409)

    assert success_count == 3, f"Expected 3 successful bookings, but got {success_count}. Statuses: {status_codes}"
    assert conflict_count == 7, f"Expected 7 conflicts (409), but got {conflict_count}. Statuses: {status_codes}"

    # 5. Verify final ride state has exactly 0 seats remaining
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as verify_client:
        final_ride_resp = await verify_client.get(f"{API_PREFIX}/rides/{ride_id}")
        assert final_ride_resp.status_code == 200
        final_ride = final_ride_resp.json()
        assert final_ride["available_seats"] == 0, f"Expected 0 available seats, got {final_ride['available_seats']}"
