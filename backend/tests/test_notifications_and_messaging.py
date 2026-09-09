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
    d_email = f"msg_driver_{d_uid}@example.com"
    d_phone = f"+9192{uuid4().int % 100000000:08d}"

    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": d_email,
            "phone_number": d_phone,
            "password": "SecurePassword123!",
            "first_name": "Kiran",
            "last_name": "Rao",
            "role": "driver",
        },
    )
    d_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": d_email, "password": "SecurePassword123!"},
    )
    driver_token = d_login.json()["access_token"]
    driver_id = d_login.json()["user"]["id"]

    reg_num = f"KA{uuid4().int % 100:02d}ZZ{uuid4().int % 10000:04d}"
    veh_resp = await client.post(
        f"{API_PREFIX}/vehicles",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={
            "vehicle_type": "car",
            "make": "Hyundai",
            "model": "i20",
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
            "origin": f"MsgOrigin_{uuid4().hex[:4]}",
            "destination": f"MsgDest_{uuid4().hex[:4]}",
            "departure_at": dep_time.isoformat(),
            "available_seats": 3,
            "price_per_seat": 250.0,
        },
    )
    ride_id = ride_resp.json()["id"]

    # 2. Rider
    r_uid = uuid4().hex[:8]
    r_email = f"msg_rider_{r_uid}@example.com"
    r_phone = f"+9193{uuid4().int % 100000000:08d}"

    await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": r_email,
            "phone_number": r_phone,
            "password": "SecurePassword123!",
            "first_name": "Sneha",
            "last_name": "Patel",
            "role": "rider",
        },
    )
    r_login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": r_email, "password": "SecurePassword123!"},
    )
    rider_token = r_login.json()["access_token"]
    rider_id = r_login.json()["user"]["id"]

    return driver_token, driver_id, rider_token, rider_id, ride_id


@pytest.mark.asyncio
async def test_notifications_lifecycle():
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        driver_token, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        # 1. Driver initially has 0 notifications
        notif_resp = await client.get(
            f"{API_PREFIX}/notifications",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert notif_resp.status_code == 200
        data = notif_resp.json()
        assert data["unread_count"] == 0
        assert data["total"] == 0

        # 2. Rider books a seat -> generates notification for Driver
        booking_resp = await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride_id, "seats_booked": 1},
        )
        assert booking_resp.status_code == 201

        # Check driver's notifications
        notif_resp2 = await client.get(
            f"{API_PREFIX}/notifications",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert notif_resp2.status_code == 200
        data2 = notif_resp2.json()
        assert data2["total"] == 1
        assert data2["unread_count"] == 1
        notif_item = data2["items"][0]
        assert notif_item["type"] == "booking_created"
        assert notif_item["is_read"] is False

        # 3. Mark notification as read
        notif_id = notif_item["id"]
        read_resp = await client.patch(
            f"{API_PREFIX}/notifications/{notif_id}/read",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert read_resp.status_code == 200
        assert read_resp.json()["is_read"] is True

        # Check unread count is now 0
        notif_resp3 = await client.get(
            f"{API_PREFIX}/notifications",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert notif_resp3.json()["unread_count"] == 0

        # 4. Mark all as read endpoint
        mark_all_resp = await client.post(
            f"{API_PREFIX}/notifications/mark-all-read",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert mark_all_resp.status_code == 200
        assert "updated_count" in mark_all_resp.json()


@pytest.mark.asyncio
async def test_trip_messaging_authorized_participants():
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        driver_token, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        # Confirm booking so rider is a verified passenger
        await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride_id, "seats_booked": 1},
        )

        # 1. Driver posts a message to trip channel
        driver_msg_resp = await client.post(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"content": "Welcome aboard! Leaving near the central metro station."},
        )
        assert driver_msg_resp.status_code == 201
        msg1 = driver_msg_resp.json()
        assert msg1["content"] == "Welcome aboard! Leaving near the central metro station."
        assert msg1["sender"]["full_name"] == "Kiran Rao"

        # 2. Rider posts a reply
        rider_msg_resp = await client.post(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"content": "Great, see you there at 8:00 AM sharp!"},
        )
        assert rider_msg_resp.status_code == 201
        msg2 = rider_msg_resp.json()
        assert msg2["content"] == "Great, see you there at 8:00 AM sharp!"
        assert msg2["sender"]["full_name"] == "Sneha Patel"

        # 3. Rider checks message list
        list_resp = await client.get(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert list_resp.status_code == 200
        messages = list_resp.json()["items"]
        assert len(messages) == 2
        assert messages[0]["content"] == "Welcome aboard! Leaving near the central metro station."
        assert messages[1]["content"] == "Great, see you there at 8:00 AM sharp!"

        # 4. Message posting automatically generated notification for rider
        rider_notifs = await client.get(
            f"{API_PREFIX}/notifications",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert rider_notifs.status_code == 200
        rider_items = rider_notifs.json()["items"]
        msg_notifs = [n for n in rider_items if n["type"] == "trip_message"]
        assert len(msg_notifs) >= 1
        assert "Leaving near the central metro station" in msg_notifs[0]["message"]


@pytest.mark.asyncio
async def test_trip_messaging_unauthorized_user_forbidden():
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        driver_token, driver_id, rider_token, rider_id, ride_id = await setup_travel_scenario(client)

        # Register a 3rd unrelated user
        u_uid = uuid4().hex[:8]
        u_email = f"stranger_{u_uid}@example.com"
        await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": u_email,
                "phone_number": f"+9191{uuid4().int % 100000000:08d}",
                "password": "SecurePassword123!",
                "first_name": "Stranger",
                "last_name": "User",
            },
        )
        stranger_login = await client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": u_email, "password": "SecurePassword123!"},
        )
        stranger_token = stranger_login.json()["access_token"]

        # Attempt to read messages -> 403 Forbidden
        read_resp = await client.get(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {stranger_token}"},
        )
        assert read_resp.status_code == 403

        # Attempt to post a message -> 403 Forbidden
        post_resp = await client.post(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {stranger_token}"},
            json={"content": "Can I hijack your ride conversation?"},
        )
        assert post_resp.status_code == 403
