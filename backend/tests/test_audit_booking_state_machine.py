"""Phase 7: Booking State Machine and Transition Matrix Audit Test Suite.

Verifies valid lifecycle branches and asserts that all invalid state transitions
(e.g., completed -> confirmed, cancelled -> confirmed) are rejected with 409 Conflict.
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
from app.modules.api.v1.bookings.service import BookingService
from app.core.database import AsyncSessionFactory
from uuid import UUID

API_PREFIX = "/api/v1"


async def setup_ride_and_booking(client: AsyncClient) -> tuple[str, str, str, str, str, str]:
    """Returns (driver_token, driver_id, rider_token, rider_id, ride_id, booking_id)."""
    # Driver
    d_email = f"sm_drv_{uuid4().hex[:8]}@example.com"
    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": d_email,
            "phone_number": f"+9191{uuid4().int % 100000000:08d}",
            "password": "SecurePassword123!",
            "first_name": "State",
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
            "make": "Toyota",
            "model": "Yaris",
            "registration_number": f"KA{uuid4().int % 100:02d}SM{uuid4().int % 10000:04d}",
            "seat_capacity": 4,
        },
    )
    vehicle_id = v_resp.json()["id"]

    dep_time = datetime.now(timezone.utc) + timedelta(days=3)
    r_resp = await client.post(
        f"{API_PREFIX}/rides",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_id": vehicle_id,
            "origin": "Electronic City",
            "destination": "Hebbal",
            "departure_at": dep_time.isoformat(),
            "available_seats": 3,
            "price_per_seat": 180.0,
        },
    )
    ride_id = r_resp.json()["id"]

    # Rider
    r_email = f"sm_rdr_{uuid4().hex[:8]}@example.com"
    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": r_email,
            "phone_number": f"+9192{uuid4().int % 100000000:08d}",
            "password": "SecurePassword123!",
            "first_name": "State",
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
        json={"ride_id": ride_id, "seats_booked": 1},
    )
    assert b_resp.status_code == 201
    booking_id = b_resp.json()["id"]

    return driver_token, driver_id, rider_token, rider_id, ride_id, booking_id


@pytest.mark.asyncio
async def test_valid_and_invalid_state_transitions():
    """Phase 7: Verify complete booking state machine transition matrix."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, rider_id, ride_id, booking_id = await setup_ride_and_booking(client)

        # 1. Booking created is in 'confirmed' status
        b_get = await client.get(
            f"{API_PREFIX}/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert b_get.status_code == 200
        assert b_get.json()["status"] == "confirmed"

        # 2. Complete booking (confirmed -> completed) by driver
        comp_resp = await client.post(
            f"{API_PREFIX}/bookings/{booking_id}/complete",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert comp_resp.status_code == 200
        assert comp_resp.json()["status"] == "completed"

        # 3. Invalid transition: completed -> cancelled must FAIL (409 Conflict)
        cancel_resp = await client.post(
            f"{API_PREFIX}/bookings/{booking_id}/cancel",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert cancel_resp.status_code == 409
        assert "already" in cancel_resp.json()["detail"].lower() or "invalid" in cancel_resp.json()["detail"].lower()

        # 4. Invalid transition directly via service: completed -> confirmed must FAIL (409 Conflict)
        from app.core.exceptions import ConflictError
        async with AsyncSessionFactory() as session:
            service = BookingService(session)
            with pytest.raises(ConflictError) as exc_info:
                await service.transition_status(
                    booking_id=UUID(booking_id),
                    new_status="confirmed",
                    actor_id=UUID(driver_id),
                )
            assert "cannot change status from 'completed' to 'confirmed'" in str(exc_info.value).lower()

        # 5. Invalid transition: completed -> requested must FAIL (409 Conflict)
        async with AsyncSessionFactory() as session:
            service = BookingService(session)
            with pytest.raises(ConflictError) as exc_info:
                await service.transition_status(
                    booking_id=UUID(booking_id),
                    new_status="requested",
                    actor_id=UUID(driver_id),
                )
            assert "cannot change status from 'completed' to 'requested'" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_cancelled_booking_terminal_transition():
    """Phase 7: Once cancelled, booking cannot transition to confirmed or completed."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, rider_id, ride_id, booking_id = await setup_ride_and_booking(client)

        # Rider cancels confirmed booking
        c_resp = await client.post(
            f"{API_PREFIX}/bookings/{booking_id}/cancel",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"reason": "Change of schedule"},
        )
        assert c_resp.status_code == 200
        assert c_resp.json()["status"] == "cancelled"

        # Double cancellation must FAIL with 409
        c2_resp = await client.post(
            f"{API_PREFIX}/bookings/{booking_id}/cancel",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert c2_resp.status_code == 409

        # Attempt to complete cancelled booking must FAIL with 409
        comp_resp = await client.post(
            f"{API_PREFIX}/bookings/{booking_id}/complete",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert comp_resp.status_code == 409


@pytest.mark.asyncio
async def test_booking_boundary_validation():
    """Phase 7: Seat limits, duplicate booking prevention, self-booking block."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, rider_id, ride_id, _ = await setup_ride_and_booking(client)

        # 1. Zero seats booked -> 422 Unprocessable
        zero_resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride_id, "seats_booked": 0},
        )
        assert zero_resp.status_code == 422

        # 2. More than 8 seats booked -> 422 Unprocessable
        nine_resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride_id, "seats_booked": 9},
        )
        assert nine_resp.status_code == 422

        # 3. Driver cannot book seat on own ride -> 409 Conflict
        self_book = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"ride_id": ride_id, "seats_booked": 1},
        )
        assert self_book.status_code == 409
        assert "own ride" in self_book.json()["detail"].lower()

        # 4. Duplicate active booking on same ride -> 409 Conflict
        dup_book = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride_id, "seats_booked": 1},
        )
        assert dup_book.status_code == 409
        assert "already have an active booking" in dup_book.json()["detail"].lower()
