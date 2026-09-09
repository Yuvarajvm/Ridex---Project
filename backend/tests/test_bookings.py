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


async def create_user_and_login(client: AsyncClient, prefix: str, role: str = "rider") -> tuple[str, str]:
    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    phone = f"+9197{uuid4().int % 100000000:08d}"
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


async def create_driver_with_ride(client: AsyncClient, capacity: int = 4, available_seats: int = 3, price: float = 300.0) -> tuple[str, str, dict]:
    driver_token, driver_id = await create_user_and_login(client, "driver", role="driver")
    reg_num = f"KA{uuid4().int % 100:02d}ZZ{uuid4().int % 10000:04d}"

    veh_resp = await client.post(
        f"{API_PREFIX}/vehicles",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_type": "car",
            "make": "Honda",
            "model": "City",
            "registration_number": reg_num,
            "seat_capacity": capacity,
        },
    )
    assert veh_resp.status_code == 201
    vehicle = veh_resp.json()

    dep_time = datetime.now(timezone.utc) + timedelta(days=4)
    origin = f"Origin_{uuid4().hex[:4]}"
    destination = f"Dest_{uuid4().hex[:4]}"

    ride_resp = await client.post(
        f"{API_PREFIX}/rides",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_id": vehicle["id"],
            "origin": origin,
            "destination": destination,
            "departure_at": dep_time.isoformat(),
            "available_seats": available_seats,
            "price_per_seat": price,
            "notes": "Comfortable ride",
        },
    )
    assert ride_resp.status_code == 201
    return driver_token, driver_id, ride_resp.json()


@pytest.mark.asyncio
async def test_create_booking_unauthenticated():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        resp = await client.post(
            f"{API_PREFIX}/bookings",
            json={"ride_id": str(uuid4()), "seats_booked": 1},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_driver_cannot_book_own_ride():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, _, ride = await create_driver_with_ride(client)

        resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"ride_id": ride["id"], "seats_booked": 1},
        )
    assert resp.status_code == 409
    assert "own ride" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_rider_books_seats_successfully():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, ride = await create_driver_with_ride(client, available_seats=3, price=250.0)
        rider_token, rider_id = await create_user_and_login(client, "passenger")

        resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride["id"], "seats_booked": 2},
        )
        assert resp.status_code == 201
        booking = resp.json()

        assert booking["ride_id"] == ride["id"]
        assert booking["rider_id"] == rider_id
        assert booking["seats_booked"] == 2
        assert float(booking["total_fare"]) == 500.0  # 2 * 250.0
        assert booking["status"] == "confirmed"
        assert booking["ride"] is not None
        assert booking["ride"]["origin"] == ride["origin"]

        # Verify ride's remaining seats were decremented from 3 to 1
        ride_resp = await client.get(f"{API_PREFIX}/rides/{ride['id']}")
        assert ride_resp.status_code == 200
        assert ride_resp.json()["available_seats"] == 1


@pytest.mark.asyncio
async def test_cannot_book_more_seats_than_available():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, ride = await create_driver_with_ride(client, available_seats=2)
        rider_token, _ = await create_user_and_login(client, "greedy_rider")

        resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride["id"], "seats_booked": 3},
        )
        assert resp.status_code == 409
        assert "remain available" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_double_book_same_ride():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, ride = await create_driver_with_ride(client, available_seats=4)
        rider_token, _ = await create_user_and_login(client, "repeat_rider")

        resp1 = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride["id"], "seats_booked": 1},
        )
        assert resp1.status_code == 201

        resp2 = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride["id"], "seats_booked": 1},
        )
        assert resp2.status_code == 409
        assert "already have an active booking" in resp2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cancel_booking_restores_available_seats():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, ride = await create_driver_with_ride(client, available_seats=3)
        rider_token, _ = await create_user_and_login(client, "cancelling_rider")

        book_resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride["id"], "seats_booked": 2},
        )
        assert book_resp.status_code == 201
        booking_id = book_resp.json()["id"]

        # Seats should be 1
        ride_resp1 = await client.get(f"{API_PREFIX}/rides/{ride['id']}")
        assert ride_resp1.json()["available_seats"] == 1

        # Cancel booking
        cancel_resp = await client.post(
            f"{API_PREFIX}/bookings/{booking_id}/cancel",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"reason": "Change of schedule"},
        )
        assert cancel_resp.status_code == 200
        cancelled_data = cancel_resp.json()
        assert cancelled_data["status"] == "cancelled"
        assert cancelled_data["cancellation_reason"] == "Change of schedule"

        # Seats restored back to 3!
        ride_resp2 = await client.get(f"{API_PREFIX}/rides/{ride['id']}")
        assert ride_resp2.json()["available_seats"] == 3


@pytest.mark.asyncio
async def test_unauthorized_user_cannot_cancel_booking():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, ride = await create_driver_with_ride(client)
        rider_token, _ = await create_user_and_login(client, "victim_rider")
        intruder_token, _ = await create_user_and_login(client, "intruder")

        book_resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride["id"], "seats_booked": 1},
        )
        assert book_resp.status_code == 201
        booking_id = book_resp.json()["id"]

        cancel_resp = await client.post(
            f"{API_PREFIX}/bookings/{booking_id}/cancel",
            headers={"Authorization": f"Bearer {intruder_token}"},
        )
        assert cancel_resp.status_code == 403


@pytest.mark.asyncio
async def test_list_my_bookings_and_ride_bookings():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, _, ride = await create_driver_with_ride(client)
        rider_token, _ = await create_user_and_login(client, "listing_rider")

        book_resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride["id"], "seats_booked": 1},
        )
        assert book_resp.status_code == 201

        # Rider lists bookings
        my_resp = await client.get(
            f"{API_PREFIX}/bookings/my",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert my_resp.status_code == 200
        my_data = my_resp.json()
        assert my_data["total"] >= 1
        assert any(b["id"] == book_resp.json()["id"] for b in my_data["items"])

        # Driver lists ride bookings
        driver_resp = await client.get(
            f"{API_PREFIX}/bookings/ride/{ride['id']}",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert driver_resp.status_code == 200
        driver_data = driver_resp.json()
        assert driver_data["total"] >= 1
        assert any(b["id"] == book_resp.json()["id"] for b in driver_data["items"])
