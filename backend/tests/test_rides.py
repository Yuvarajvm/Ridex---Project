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


@pytest.mark.asyncio
async def test_list_rides_returns_success():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"{API_PREFIX}/rides")

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)


@pytest.mark.asyncio
async def test_list_rides_supports_origin_filter():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides",
            params={"origin": "Nandyal"},
        )

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data

    for ride in data["items"]:
        assert ride["origin"].strip().lower() == "nandyal"


@pytest.mark.asyncio
async def test_list_rides_supports_destination_filter():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides",
            params={"destination": "Kurnool"},
        )

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data

    for ride in data["items"]:
        assert ride["destination"].strip().lower() == "kurnool"


@pytest.mark.asyncio
async def test_list_rides_rejects_same_origin_and_destination():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides",
            params={
                "origin": "Nandyal",
                "destination": "Nandyal",
            },
        )

    assert response.status_code in {400, 422}


@pytest.mark.asyncio
async def test_list_rides_supports_date_filter():
    target_date = (
        datetime.now(timezone.utc) + timedelta(days=1)
    ).date().isoformat()

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides",
            params={"date": target_date},
        )

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_list_rides_rejects_invalid_date():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides",
            params={"date": "not-a-date"},
        )

    assert response.status_code in {400, 422}


@pytest.mark.asyncio
async def test_list_rides_respects_limit():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides",
            params={"limit": 1},
        )

    assert response.status_code == 200

    data = response.json()

    assert len(data["items"]) <= 1


@pytest.mark.asyncio
async def test_list_rides_rejects_invalid_limit():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides",
            params={"limit": 0},
        )

    assert response.status_code in {400, 422}


@pytest.mark.asyncio
async def test_availability_returns_success():
    now = datetime.now(timezone.utc)

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides/availability",
            params={
                "origin": "Nandyal",
                "destination": "Kurnool",
                "year": now.year,
                "month": now.month,
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert "dates" in data
    assert isinstance(data["dates"], list)


@pytest.mark.asyncio
async def test_availability_rejects_same_route():
    now = datetime.now(timezone.utc)

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides/availability",
            params={
                "origin": "Nandyal",
                "destination": "Nandyal",
                "year": now.year,
                "month": now.month,
            },
        )

    assert response.status_code in {400, 422}


@pytest.mark.asyncio
async def test_availability_rejects_invalid_month():
    now = datetime.now(timezone.utc)

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides/availability",
            params={
                "origin": "Nandyal",
                "destination": "Kurnool",
                "year": now.year,
                "month": 13,
            },
        )

    assert response.status_code in {400, 422}


@pytest.mark.asyncio
async def test_get_nonexistent_ride_returns_not_found():
    ride_id = uuid4()

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            f"{API_PREFIX}/rides/{ride_id}",
        )

    assert response.status_code == 404


async def _create_user_and_login(client: AsyncClient, prefix: str, role: str = "rider") -> tuple[str, str]:
    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    phone = f"+9196{uuid4().int % 100000000:08d}"
    password = "SecurePassword123!"

    reg_resp = await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": email,
            "phone_number": phone,
            "password": password,
            "first_name": "Test",
            "last_name": "User",
            "role": role,
        },
    )
    assert reg_resp.status_code == 201

    login_resp = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    user_id = reg_resp.json()["user"]["id"]
    return token, user_id


async def _create_driver_with_ride(client: AsyncClient, available_seats: int = 4, price: float = 400.0) -> tuple[str, str, dict]:
    driver_token, driver_id = await _create_user_and_login(client, "driver", role="driver")
    reg_num = f"DL{uuid4().int % 100:02d}AA{uuid4().int % 10000:04d}"

    veh_resp = await client.post(
        f"{API_PREFIX}/vehicles",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_type": "car",
            "make": "Toyota",
            "model": "Innova",
            "registration_number": reg_num,
            "seat_capacity": 6,
        },
    )
    assert veh_resp.status_code == 201
    vehicle = veh_resp.json()

    dep_time = datetime.now(timezone.utc) + timedelta(days=3)
    ride_resp = await client.post(
        f"{API_PREFIX}/rides",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_id": vehicle["id"],
            "origin": "Bangalore",
            "destination": "Mysore",
            "departure_at": dep_time.isoformat(),
            "available_seats": available_seats,
            "price_per_seat": price,
            "notes": "Express highway trip",
        },
    )
    assert ride_resp.status_code == 201
    return driver_token, driver_id, ride_resp.json()


@pytest.mark.asyncio
async def test_driver_my_rides_and_passenger_manifest_and_cancel():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # 1. Driver creates ride
        driver_token, driver_id, ride = await _create_driver_with_ride(client, available_seats=4, price=450.0)
        ride_id = ride["id"]

        # 2. Driver lists my rides
        my_rides_resp = await client.get(
            f"{API_PREFIX}/rides/my",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert my_rides_resp.status_code == 200
        my_rides = my_rides_resp.json()
        assert "items" in my_rides
        assert any(r["id"] == ride_id for r in my_rides["items"])

        # 3. Rider books 2 seats
        rider_token, rider_id = await _create_user_and_login(client, "rider", role="rider")
        book_resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "ride_id": ride_id,
                "seats_booked": 2,
            },
        )
        assert book_resp.status_code == 201
        booking = book_resp.json()
        assert booking["status"] == "confirmed"

        # 4. Driver views passenger bookings/manifest
        manifest_resp = await client.get(
            f"{API_PREFIX}/rides/{ride_id}/bookings",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert manifest_resp.status_code == 200
        manifest = manifest_resp.json()
        assert manifest["total"] == 1
        passenger_item = manifest["items"][0]
        assert passenger_item["seats_booked"] == 2
        assert float(passenger_item["total_fare"]) == 900.0
        assert passenger_item["rider"] is not None
        assert "email" in passenger_item["rider"]
        assert "phone_number" in passenger_item["rider"]

        # 5. Non-driver is forbidden from viewing manifest
        other_rider_token, _ = await _create_user_and_login(client, "intruder", role="rider")
        forbidden_resp = await client.get(
            f"{API_PREFIX}/rides/{ride_id}/bookings",
            headers={"Authorization": f"Bearer {other_rider_token}"},
        )
        assert forbidden_resp.status_code == 403

        # 6. Driver cancels their ride with reason
        cancel_resp = await client.post(
            f"{API_PREFIX}/rides/{ride_id}/cancel",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"reason": "Driver emergency - vehicle punctured"},
        )
        assert cancel_resp.status_code == 200
        cancelled_ride = cancel_resp.json()
        assert cancelled_ride["status"] == "cancelled"

        # 7. Check that the rider's booking is now cancelled
        rider_booking_resp = await client.get(
            f"{API_PREFIX}/bookings/my",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert rider_booking_resp.status_code == 200
        rider_bookings = rider_booking_resp.json()["items"]
        matching_booking = next((b for b in rider_bookings if b["id"] == booking["id"]), None)
        assert matching_booking is not None
        assert matching_booking["status"] == "cancelled"
        assert "punctured" in (matching_booking["cancellation_reason"] or "").lower()