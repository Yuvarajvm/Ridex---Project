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


async def create_user_and_login(client: AsyncClient, email_prefix: str, role: str = "driver") -> tuple[str, str]:
    uid = uuid4().hex[:8]
    email = f"{email_prefix}_{uid}@example.com"
    phone = f"+9198{uuid4().int % 100000000:08d}"
    password = "SecurePassword123!"

    reg_resp = await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": email,
            "phone_number": phone,
            "password": password,
            "first_name": "Rider",
            "last_name": "Driver",
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


async def create_vehicle(client: AsyncClient, token: str, capacity: int = 4) -> dict:
    reg_num = f"AP{uuid4().int % 100:02d}XY{uuid4().int % 10000:04d}"
    resp = await client.post(
        f"{API_PREFIX}/vehicles",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "vehicle_type": "car",
            "make": "Toyota",
            "model": "Innova",
            "color": "Silver",
            "registration_number": reg_num,
            "seat_capacity": capacity,
        },
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_create_ride_unauthenticated():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        resp = await client.post(
            f"{API_PREFIX}/rides",
            json={
                "vehicle_id": str(uuid4()),
                "origin": "Nandyal",
                "destination": "Hyderabad",
                "departure_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                "available_seats": 3,
                "price_per_seat": 350.0,
            },
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_ride_nonexistent_vehicle():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        token, _ = await create_user_and_login(client, "driver_no_veh")
        resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "vehicle_id": str(uuid4()),
                "origin": "Nandyal",
                "destination": "Hyderabad",
                "departure_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                "available_seats": 3,
                "price_per_seat": 350.0,
            },
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_ride_other_users_vehicle_forbidden():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver1_token, _ = await create_user_and_login(client, "driver1")
        driver2_token, _ = await create_user_and_login(client, "driver2")

        vehicle = await create_vehicle(client, driver1_token)

        resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {driver2_token}"},
            json={
                "vehicle_id": vehicle["id"],
                "origin": "Nandyal",
                "destination": "Hyderabad",
                "departure_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                "available_seats": 3,
                "price_per_seat": 350.0,
            },
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_ride_exceeds_vehicle_capacity():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, _ = await create_user_and_login(client, "cap_driver")
        vehicle = await create_vehicle(client, driver_token, capacity=3)

        resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_id": vehicle["id"],
                "origin": "Nandyal",
                "destination": "Hyderabad",
                "departure_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                "available_seats": 4,  # greater than capacity 3
                "price_per_seat": 350.0,
            },
        )
    assert resp.status_code == 400
    assert "capacity" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_ride_success_and_retrieval():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, driver_id = await create_user_and_login(client, "real_driver")
        vehicle = await create_vehicle(client, driver_token, capacity=4)

        dep_time = datetime.now(timezone.utc) + timedelta(days=3)
        origin = f"Anantapur_{uuid4().hex[:4]}"
        destination = f"Tirupati_{uuid4().hex[:4]}"

        resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_id": vehicle["id"],
                "origin": origin,
                "destination": destination,
                "departure_at": dep_time.isoformat(),
                "available_seats": 3,
                "price_per_seat": 450.0,
                "notes": "AC car, luggage space available.",
            },
        )
        assert resp.status_code == 201
        ride_data = resp.json()

        assert ride_data["driver_id"] == driver_id
        assert ride_data["vehicle_id"] == vehicle["id"]
        assert ride_data["origin"] == origin
        assert ride_data["destination"] == destination
        assert ride_data["available_seats"] == 3
        assert float(ride_data["price_per_seat"]) == 450.0
        assert ride_data["status"] == "scheduled"
        assert ride_data["notes"] == "AC car, luggage space available."

        ride_id = ride_data["id"]

        # Retrieve by ID
        get_resp = await client.get(f"{API_PREFIX}/rides/{ride_id}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["id"] == ride_id
        assert fetched["origin"] == origin
        assert fetched["vehicle"] is not None
        assert fetched["vehicle"]["make"] == "Toyota"
        assert fetched["vehicle"]["model"] == "Innova"
        assert fetched["driver"] is not None
        assert fetched["driver"]["full_name"] == "Rider Driver"

        # Search marketplace
        search_resp = await client.get(
            f"{API_PREFIX}/rides",
            params={"origin": origin, "destination": destination},
        )
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        assert search_data["total"] >= 1
        matching = [r for r in search_data["items"] if r["id"] == ride_id]
        assert len(matching) == 1
        assert matching[0]["vehicle"]["make"] == "Toyota"
