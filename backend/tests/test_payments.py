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


async def setup_rider_with_booking(client: AsyncClient, price: float = 200.0) -> tuple[str, str, dict]:
    # 1. Driver creates vehicle and ride
    d_uid = uuid4().hex[:8]
    d_email = f"pay_driver_{d_uid}@example.com"
    d_phone = f"+9196{uuid4().int % 100000000:08d}"

    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": d_email,
            "phone_number": d_phone,
            "password": "SecurePassword123!",
            "first_name": "Driver",
            "last_name": "Host",
            "role": "driver",
        },
    )
    d_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": d_email, "password": "SecurePassword123!"},
    )
    driver_token = d_login.json()["access_token"]

    reg_num = f"MH{uuid4().int % 100:02d}AA{uuid4().int % 10000:04d}"
    veh_resp = await client.post(
        f"{API_PREFIX}/vehicles",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_type": "car",
            "make": "Hyundai",
            "model": "Creta",
            "registration_number": reg_num,
            "seat_capacity": 4,
        },
    )
    vehicle = veh_resp.json()

    dep_time = datetime.now(timezone.utc) + timedelta(days=5)
    ride_resp = await client.post(
        f"{API_PREFIX}/rides",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_id": vehicle["id"],
            "origin": f"PayOrigin_{uuid4().hex[:4]}",
            "destination": f"PayDest_{uuid4().hex[:4]}",
            "departure_at": dep_time.isoformat(),
            "available_seats": 3,
            "price_per_seat": price,
        },
    )
    ride = ride_resp.json()

    # 2. Rider registers, logs in, and books
    r_uid = uuid4().hex[:8]
    r_email = f"pay_rider_{r_uid}@example.com"
    r_phone = f"+9195{uuid4().int % 100000000:08d}"

    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": r_email,
            "phone_number": r_phone,
            "password": "SecurePassword123!",
            "first_name": "Rider",
            "last_name": "Passenger",
            "role": "rider",
        },
    )
    r_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": r_email, "password": "SecurePassword123!"},
    )
    rider_token = r_login.json()["access_token"]
    rider_id = r_login.json()["user"]["id"]

    book_resp = await client.post(
        f"{API_PREFIX}/bookings",
        headers={"Authorization": f"Bearer {rider_token}"},
        json={"ride_id": ride["id"], "seats_booked": 2},
    )
    assert book_resp.status_code == 201
    booking = book_resp.json()

    return rider_token, rider_id, booking


@pytest.mark.asyncio
async def test_payment_intent_unauthenticated():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        resp = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            json={"booking_id": str(uuid4())},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_payment_intent_nonexistent_booking():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        rider_token, _, _ = await setup_rider_with_booking(client)
        resp = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": str(uuid4())},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_payment_intent_other_users_booking():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        _, _, booking = await setup_rider_with_booking(client)
        intruder_token, _, _ = await setup_rider_with_booking(client)

        resp = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {intruder_token}"},
            json={"booking_id": booking["id"]},
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_payment_intent_and_process_success():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        rider_token, rider_id, booking = await setup_rider_with_booking(client, price=250.0)

        # 1. Create intent
        intent_resp = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": booking["id"]},
        )
        assert intent_resp.status_code == 201
        intent_data = intent_resp.json()

        assert intent_data["booking_id"] == booking["id"]
        assert float(intent_data["amount"]) == 500.0  # 2 * 250.0
        assert intent_data["currency"] == "INR"
        assert intent_data["status"] == "pending"
        assert intent_data["provider"] == "mock"
        assert intent_data["client_secret"] is not None

        payment_id = intent_data["payment_id"]

        # 2. Process / capture payment
        process_resp = await client.post(
            f"{API_PREFIX}/payments/process",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "payment_id": payment_id,
                "payment_method": "upi",
                "simulate_failure": False,
            },
        )
        assert process_resp.status_code == 200
        payment_data = process_resp.json()

        assert payment_data["id"] == payment_id
        assert payment_data["status"] == "succeeded"
        assert payment_data["provider_payment_id"] is not None
        assert payment_data["error_message"] is None

        # 3. Retrieve by ID
        get_resp = await client.get(
            f"{API_PREFIX}/payments/{payment_id}",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["status"] == "succeeded"

        # 4. Creating duplicate intent on already paid booking should be rejected
        dup_resp = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": booking["id"]},
        )
        assert dup_resp.status_code == 409


@pytest.mark.asyncio
async def test_process_payment_simulated_failure():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        rider_token, _, booking = await setup_rider_with_booking(client)

        intent_resp = await client.post(
            f"{API_PREFIX}/payments/create-intent",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"booking_id": booking["id"]},
        )
        payment_id = intent_resp.json()["payment_id"]

        process_resp = await client.post(
            f"{API_PREFIX}/payments/process",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "payment_id": payment_id,
                "payment_method": "card",
                "simulate_failure": True,
            },
        )
        assert process_resp.status_code == 200
        payment_data = process_resp.json()

        assert payment_data["status"] == "failed"
        assert payment_data["error_message"] is not None
