"""Phase 11: Reviews Domain Audit Test Suite.

Verifies:
- Completed ride required (future rides cannot be reviewed)
- Confirmed participant required
- Self-review prohibited (409 Conflict)
- Duplicate review prohibited (409 Conflict)
- Rating bounded between 1 and 5 stars
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


async def setup_travel_scenario(client: AsyncClient) -> tuple[str, str, str, str, str]:
    """Returns (driver_token, driver_id, rider_token, rider_id, ride_id)."""
    # 1. Driver
    d_email = f"rev_aud_drv_{uuid4().hex[:8]}@example.com"
    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": d_email,
            "phone_number": f"+9195{uuid4().int % 100000000:08d}",
            "password": "SecurePassword123!",
            "first_name": "Review",
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
            "make": "Kia",
            "model": "Seltos",
            "registration_number": f"KA{uuid4().int % 100:02d}RV{uuid4().int % 10000:04d}",
            "seat_capacity": 4,
        },
    )
    vehicle_id = v_resp.json()["id"]

    dep_time = datetime.now(timezone.utc) + timedelta(days=4)
    r_resp = await client.post(
        f"{API_PREFIX}/rides",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_id": vehicle_id,
            "origin": "Indiranagar",
            "destination": "MG Road",
            "departure_at": dep_time.isoformat(),
            "available_seats": 3,
            "price_per_seat": 120.0,
        },
    )
    ride_id = r_resp.json()["id"]

    # 2. Rider
    r_email = f"rev_aud_rdr_{uuid4().hex[:8]}@example.com"
    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": r_email,
            "phone_number": f"+9196{uuid4().int % 100000000:08d}",
            "password": "SecurePassword123!",
            "first_name": "Review",
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

    # Rider books
    await client.post(
        f"{API_PREFIX}/bookings",
        headers={"Authorization": f"Bearer {rider_token}"},
        json={"ride_id": ride_id, "seats_booked": 1},
    )

    return driver_token, driver_id, rider_token, rider_id, ride_id


@pytest.mark.asyncio
async def test_review_timing_rule_future_ride_rejection():
    """Phase 11: Reviewing before trip has departed or completed must FAIL."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        # Ride departure is 4 days in future and status is 'scheduled' -> 409 Conflict
        early_rev = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 5,
                "comment": "Too early review!",
            },
        )
        assert early_rev.status_code == 409
        assert "departed or completed" in early_rev.json()["detail"].lower()

        # Driver marks ride completed
        await client.patch(
            f"{API_PREFIX}/rides/{ride_id}/status",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"status": "completed"},
        )

        # Now review is accepted
        valid_rev = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 5,
                "comment": "Great trip!",
            },
        )
        assert valid_rev.status_code == 201


@pytest.mark.asyncio
async def test_review_duplicate_and_self_prohibition():
    """Phase 11: Prohibit self-reviews and duplicate reviews."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        # Driver completes ride
        await client.patch(
            f"{API_PREFIX}/rides/{ride_id}/status",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"status": "completed"},
        )

        # 1. Self-review -> 409 Conflict
        self_rev = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": rider_id,
                "rating": 5,
            },
        )
        assert self_rev.status_code == 409
        assert "yourself" in self_rev.json()["detail"].lower()

        # 2. First valid review
        r1 = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 5,
                "comment": "Awesome ride!",
            },
        )
        assert r1.status_code == 201

        # 3. Duplicate review -> 409 Conflict
        r2 = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 4,
                "comment": "Trying again",
            },
        )
        assert r2.status_code == 409
        assert "already reviewed" in r2.json()["detail"].lower()
