import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main_module

API_PREFIX = "/api/v1"


async def setup_travel_scenario(client: AsyncClient) -> tuple[str, str, str, str, str]:
    """Returns (driver_token, driver_id, rider_token, rider_id, ride_id)."""
    # 1. Driver
    d_uid = uuid4().hex[:8]
    d_email = f"rev_driver_{d_uid}@example.com"
    d_phone = f"+9194{uuid4().int % 100000000:08d}"

    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": d_email,
            "phone_number": d_phone,
            "password": "SecurePassword123!",
            "first_name": "Ramesh",
            "last_name": "Kumar",
            "role": "driver",
        },
    )
    d_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": d_email, "password": "SecurePassword123!"},
    )
    driver_token = d_login.json()["access_token"]
    driver_id = d_login.json()["user"]["id"]

    reg_num = f"TS{uuid4().int % 100:02d}BB{uuid4().int % 10000:04d}"
    veh_resp = await client.post(
        f"{API_PREFIX}/vehicles",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_type": "car",
            "make": "Maruti",
            "model": "Swift",
            "registration_number": reg_num,
            "seat_capacity": 4,
        },
    )
    vehicle = veh_resp.json()

    dep_time = datetime.now(timezone.utc) + timedelta(days=6)
    ride_resp = await client.post(
        f"{API_PREFIX}/rides",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_id": vehicle["id"],
            "origin": f"RevOrigin_{uuid4().hex[:4]}",
            "destination": f"RevDest_{uuid4().hex[:4]}",
            "departure_at": dep_time.isoformat(),
            "available_seats": 3,
            "price_per_seat": 180.0,
        },
    )
    ride_id = ride_resp.json()["id"]

    # 2. Rider
    r_uid = uuid4().hex[:8]
    r_email = f"rev_rider_{r_uid}@example.com"
    r_phone = f"+9193{uuid4().int % 100000000:08d}"

    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": r_email,
            "phone_number": r_phone,
            "password": "SecurePassword123!",
            "first_name": "Priya",
            "last_name": "Sharma",
            "role": "rider",
        },
    )
    r_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": r_email, "password": "SecurePassword123!"},
    )
    rider_token = r_login.json()["access_token"]
    rider_id = r_login.json()["user"]["id"]

    # 3. Rider books seat
    await client.post(
        f"{API_PREFIX}/bookings",
        headers={"Authorization": f"Bearer {rider_token}"},
        json={"ride_id": ride_id, "seats_booked": 1},
    )

    # 4. Driver marks ride completed so reviews are eligible
    await client.patch(
        f"{API_PREFIX}/rides/{ride_id}/status",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"status": "completed"},
    )

    return driver_token, driver_id, rider_token, rider_id, ride_id


@pytest.mark.asyncio
async def test_review_unauthenticated():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        resp = await client.post(
            f"{API_PREFIX}/reviews",
            json={
                "ride_id": str(uuid4()),
                "reviewee_id": str(uuid4()),
                "rating": 5,
            },
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_cannot_review_self():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        resp = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": rider_id,
                "rating": 5,
            },
        )
    assert resp.status_code == 409
    assert "yourself" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_review_without_traveling_together():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, driver_id, _, _, ride_id = await setup_travel_scenario(client)

        # Stranger registers
        stranger_email = f"stranger_{uuid4().hex[:8]}@example.com"
        await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": stranger_email,
                "password": "SecurePassword123!",
                "first_name": "Stranger",
                "role": "rider",
            },
        )
        s_login = await client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": stranger_email, "password": "SecurePassword123!"},
        )
        stranger_token = s_login.json()["access_token"]

        resp = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {stranger_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 5,
            },
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_rider_reviews_driver_success():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        resp = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 5,
                "comment": "Smooth, punctual driving. Very polite!",
            },
        )
        assert resp.status_code == 201
        data = resp.json()

        assert data["ride_id"] == ride_id
        assert data["reviewer_id"] == rider_id
        assert data["reviewee_id"] == driver_id
        assert data["rating"] == 5
        assert data["comment"] == "Smooth, punctual driving. Very polite!"
        assert data["reviewer"] is not None
        assert data["reviewer"]["full_name"] == "Priya Sharma"

        # Check driver reviews list and summary
        list_resp = await client.get(f"{API_PREFIX}/reviews/user/{driver_id}")
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert list_data["total"] >= 1
        assert list_data["average_rating"] == 5.0

        summary_resp = await client.get(f"{API_PREFIX}/reviews/user/{driver_id}/summary")
        assert summary_resp.status_code == 200
        summary_data = summary_resp.json()
        assert summary_data["total_reviews"] >= 1
        assert summary_data["average_rating"] == 5.0
        assert summary_data["breakdown"]["5"] >= 1


@pytest.mark.asyncio
async def test_duplicate_review_rejected():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        resp1 = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 4,
            },
        )
        assert resp1.status_code == 201

        resp2 = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 5,
            },
        )
        assert resp2.status_code == 409
        assert "already reviewed" in resp2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_rating_rejected():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id, rider_token, _, ride_id = await setup_travel_scenario(client)

        resp = await client.post(
            f"{API_PREFIX}/reviews",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "reviewee_id": driver_id,
                "rating": 6,  # invalid rating
            },
        )
    assert resp.status_code in {400, 422}
