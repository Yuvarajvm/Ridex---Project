"""Phases 9 & 10: Payment State Separation and Idempotency Audit Test Suite.

Verifies clean decoupling between Booking state and Payment state, cross-tenant
payment protection, failure resilience, and duplicate request idempotency.
"""

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


async def setup_booking(client: AsyncClient) -> tuple[str, str, str, str, str, str]:
    """Returns (driver_token, driver_id, rider_token, rider_id, ride_id, booking_id)."""
    # Driver
    d_email = f"pay_drv_{uuid4().hex[:8]}@example.com"
    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": d_email,
            "phone_number": f"+9193{uuid4().int % 100000000:08d}",
            "password": "SecurePassword123!",
            "first_name": "Pay",
            "last_name": "Driver",
            "role": "driver",
        },
    )
    d_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": d_email, "password": "SecurePassword123!"},
    )
    driver_token = d_login.json()["access_token"]
    driver_id = d_login.json()["user"]["id"]

    v_resp = await client.post(
        f"{API_PREFIX}/vehicles",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_type": "car",
            "make": "Honda",
            "model": "Amaze",
            "registration_number": f"MH{uuid4().int % 100:02d}PY{uuid4().int % 10000:04d}",
            "seat_capacity": 4,
        },
    )
    vehicle_id = v_resp.json()["id"]

    dep_time = datetime.now(timezone.utc) + timedelta(days=5)
    r_resp = await client.post(
        f"{API_PREFIX}/rides",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_id": vehicle_id,
            "origin": "Pune Station",
            "destination": "Hinjawadi",
            "departure_at": dep_time.isoformat(),
            "available_seats": 3,
            "price_per_seat": 200.0,
        },
    )
    ride_id = r_resp.json()["id"]

    # Rider
    r_email = f"pay_rdr_{uuid4().hex[:8]}@example.com"
    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": r_email,
            "phone_number": f"+9194{uuid4().int % 100000000:08d}",
            "password": "SecurePassword123!",
            "first_name": "Pay",
            "last_name": "Rider",
            "role": "rider",
        },
    )
    r_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": r_email, "password": "SecurePassword123!"},
    )
    rider_token = r_login.json()["access_token"]
    rider_id = r_login.json()["user"]["id"]

    b_resp = await client.post(
        f"{API_PREFIX}/bookings",
        headers={"Authorization": f"Bearer {rider_token}"},
        json={"ride_id": ride_id, "seats_booked": 2},
    )
    assert b_resp.status_code == 201
    booking_id = b_resp.json()["id"]

    return driver_token, driver_id, rider_token, rider_id, ride_id, booking_id


@pytest.mark.asyncio
async def test_payment_idempotency_intent_and_capture():
    """Phase 10: Retrying intent creation and capture returns safe existing result."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, rider_token, _, _, booking_id = await setup_booking(client)

        # 1. Create first payment intent
        intent1 = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": booking_id},
        )
        assert intent1.status_code == 201
        p1 = intent1.json()
        assert p1["status"] == "pending"
        assert p1["amount"] == "400.00"

        # 2. Duplicate intent call must be IDEMPOTENT (return same pending intent)
        intent2 = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": booking_id},
        )
        assert intent2.status_code == 201
        p2 = intent2.json()
        assert p2["payment_id"] == p1["payment_id"]
        assert p2["client_secret"] == p1["client_secret"]

        # 3. Capture payment
        capture1 = await client.post(
            f"{API_PREFIX}/payments/process",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "payment_id": p1["payment_id"],
                "payment_method": "upi",
                "simulate_failure": False,
            },
        )
        assert capture1.status_code == 200
        c1 = capture1.json()
        assert c1["status"] == "succeeded"

        # 4. Duplicate capture call must be IDEMPOTENT (return succeeded without re-charging)
        capture2 = await client.post(
            f"{API_PREFIX}/payments/process",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "payment_id": p1["payment_id"],
                "payment_method": "upi",
                "simulate_failure": False,
            },
        )
        assert capture2.status_code == 200
        assert capture2.json()["status"] == "succeeded"

        # 5. Creating new intent on already succeeded payment must FAIL with 409 Conflict
        intent_after = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": booking_id},
        )
        assert intent_after.status_code == 409
        assert "already been completed" in intent_after.json()["detail"].lower()


@pytest.mark.asyncio
async def test_payment_booking_state_separation_and_failure_handling():
    """Phase 9: Payment failure does not corrupt booking; cannot pay cancelled booking."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, rider_token, rider_id, _, booking_id = await setup_booking(client)

        # Create intent
        intent_resp = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": booking_id},
        )
        assert intent_resp.status_code == 201
        payment_id = intent_resp.json()["payment_id"]

        # Simulate failed payment capture
        fail_resp = await client.post(
            f"{API_PREFIX}/payments/process",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "payment_id": payment_id,
                "payment_method": "card",
                "simulate_failure": True,
            },
        )
        assert fail_resp.status_code == 200
        assert fail_resp.json()["status"] == "failed"

        # Booking state remains valid 'confirmed'
        b_check = await client.get(
            f"{API_PREFIX}/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert b_check.status_code == 200
        assert b_check.json()["status"] == "confirmed"

        # Cross-tenant payment attempt: Stranger attempts to pay for Rider's booking -> 403 Forbidden
        thief_email = f"thief_{uuid4().hex[:8]}@example.com"
        await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": thief_email,
                "password": "SecurePassword123!",
                "first_name": "Stranger",
                "role": "rider",
            },
        )
        s_login = await client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": thief_email, "password": "SecurePassword123!"},
        )
        stranger_token = s_login.json()["access_token"]

        thief_pay = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {stranger_token}"},
            json={"booking_id": booking_id},
        )
        assert thief_pay.status_code == 403
        assert "own booking" in thief_pay.json()["detail"].lower()

        # Create another clean booking to test payment on cancelled booking
        _, _, r2_token, _, _, b2_id = await setup_booking(client)
        # Cancel booking
        await client.post(
            f"{API_PREFIX}/bookings/{b2_id}/cancel",
            headers={"Authorization": f"Bearer {r2_token}"},
        )

        # Attempt to create payment intent for cancelled booking -> 409 Conflict
        pay_cancel = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {r2_token}"},
            json={"booking_id": b2_id},
        )
        assert pay_cancel.status_code == 409
        assert "cannot pay" in pay_cancel.json()["detail"].lower()
