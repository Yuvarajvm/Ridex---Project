"""Phases 4, 5, 6, 12, 13: Security, Authentication, Cross-Tenant Authorization,

Messaging Isolation, and Admin Audit Test Suite.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings
import app.main as main_module

API_PREFIX = "/api/v1"


async def create_user(client: AsyncClient, prefix: str, role: str = "rider") -> tuple[str, str, str]:
    """Returns (token, user_id, email). Promotes to admin in DB if requested."""
    from uuid import UUID
    from sqlalchemy import update
    from app.core.database import AsyncSessionFactory
    from app.modules.api.v1.users.models import User

    uid = uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    phone = f"+9196{uuid4().int % 100000000:08d}"
    password = "SecurePassword123!"

    reg = await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": email,
            "phone_number": phone,
            "password": password,
            "first_name": "Auth",
            "last_name": prefix.capitalize(),
            "role": "rider" if role == "admin" else role,
        },
    )
    assert reg.status_code == 201
    user_id = reg.json()["user"]["id"]

    if role == "admin":
        async with AsyncSessionFactory() as session:
            await session.execute(
                update(User).where(User.id == UUID(user_id)).values(role="admin")
            )
            await session.commit()

    login = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return token, user_id, email


@pytest.mark.asyncio
async def test_auth_negative_cases():
    """Phase 4: Negative authentication tests."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # 0. Privilege escalation attempt: registering as admin is forbidden by schema
        esc_resp = await client.post(
            f"{API_PREFIX}/auth/register",
            json={
                "email": f"hacker_{uuid4().hex[:8]}@example.com",
                "password": "SecurePassword123!",
                "first_name": "Bad",
                "role": "admin",
            },
        )
        assert esc_resp.status_code == 422

        token, user_id, email = await create_user(client, "authneg", "rider")

        # 1. Wrong password
        resp = await client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": email, "password": "WrongPassword999!"},
        )
        assert resp.status_code == 401

        # 2. Unknown email
        resp = await client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": "nonexistent_email_123@example.com", "password": "AnyPassword123!"},
        )
        assert resp.status_code == 401

        # 3. Missing Authorization header on protected endpoint
        resp = await client.get(f"{API_PREFIX}/users/me")
        assert resp.status_code == 401

        # 4. Malformed Authorization header
        resp = await client.get(
            f"{API_PREFIX}/users/me",
            headers={"Authorization": "Bearer not-a-valid-jwt-token"},
        )
        assert resp.status_code == 401

        # 5. Tampered token signature
        settings = get_settings()
        tampered_token = jwt.encode(
            {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "completely-wrong-secret-key-123456789",
            algorithm=settings.jwt_algorithm,
        )
        resp = await client.get(
            f"{API_PREFIX}/users/me",
            headers={"Authorization": f"Bearer {tampered_token}"},
        )
        assert resp.status_code == 401

        # 6. Expired token
        expired_token = jwt.encode(
            {"sub": user_id, "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        resp = await client.get(
            f"{API_PREFIX}/users/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_suspended_user_is_blocked():
    """Phase 4 & 13: Suspended users cannot authenticate or make API requests."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # Create user and admin
        admin_token, admin_id, _ = await create_user(client, "admsusp", "admin")
        user_token, user_id, user_email = await create_user(client, "victim", "rider")

        # Admin suspends user
        susp_resp = await client.patch(
            f"{API_PREFIX}/admin/users/{user_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "suspended"},
        )
        assert susp_resp.status_code == 200
        assert susp_resp.json()["status"] == "suspended"

        # Suspended user tries to login -> 403 Forbidden
        login_resp = await client.post(
            f"{API_PREFIX}/auth/login",
            json={"email": user_email, "password": "SecurePassword123!"},
        )
        assert login_resp.status_code == 403
        assert "not active" in login_resp.json()["detail"].lower()

        # Suspended user's existing token is rejected on protected endpoints -> 403 Forbidden
        me_resp = await client.get(
            f"{API_PREFIX}/users/me",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert me_resp.status_code == 403
        assert "not active" in me_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cross_tenant_vehicle_and_ride_isolation():
    """Phase 5 & 6: Cross-tenant isolation between Driver A and Driver B."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # Driver A and Driver B
        token_a, id_a, _ = await create_user(client, "drva", "driver")
        token_b, id_b, _ = await create_user(client, "drvb", "driver")

        # Driver B registers vehicle B
        reg_b = f"MH{uuid4().int % 100:02d}VB{uuid4().int % 10000:04d}"
        veh_b_resp = await client.post(
            f"{API_PREFIX}/vehicles",
            headers={"Authorization": f"Bearer {token_b}"},
            json={
                "vehicle_type": "car",
                "make": "Hyundai",
                "model": "Creta",
                "registration_number": reg_b,
                "seat_capacity": 4,
            },
        )
        assert veh_b_resp.status_code == 201
        vehicle_b_id = veh_b_resp.json()["id"]

        # Driver A attempts to update Vehicle B -> 403 Forbidden
        update_resp = await client.patch(
            f"{API_PREFIX}/vehicles/{vehicle_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"color": "Red"},
        )
        assert update_resp.status_code == 403

        # Driver A attempts to delete Vehicle B -> 403 Forbidden
        del_resp = await client.delete(
            f"{API_PREFIX}/vehicles/{vehicle_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert del_resp.status_code == 403

        # Driver A attempts to publish a ride using Vehicle B -> 403 Forbidden
        dep_time = datetime.now(timezone.utc) + timedelta(days=3)
        ride_hijack_resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {token_a}"},
            json={
                "vehicle_id": vehicle_b_id,
                "origin": "Bangalore",
                "destination": "Mysore",
                "departure_at": dep_time.isoformat(),
                "available_seats": 3,
                "price_per_seat": 200.0,
            },
        )
        assert ride_hijack_resp.status_code == 403
        assert "own this vehicle" in ride_hijack_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ride_domain_validation_rules():
    """Phase 6: Ride domain validations (past departure, same origin/dest, overcapacity)."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, _, _ = await create_user(client, "ridedrv", "driver")
        reg_num = f"DL{uuid4().int % 100:02d}RR{uuid4().int % 10000:04d}"

        v_resp = await client.post(
            f"{API_PREFIX}/vehicles",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_type": "car",
                "make": "Tata",
                "model": "Nexon",
                "registration_number": reg_num,
                "seat_capacity": 3,
            },
        )
        assert v_resp.status_code == 201
        vehicle_id = v_resp.json()["id"]

        # 1. Past departure time -> 400
        past_time = datetime.now(timezone.utc) - timedelta(hours=2)
        resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_id": vehicle_id,
                "origin": "Mumbai",
                "destination": "Pune",
                "departure_at": past_time.isoformat(),
                "available_seats": 2,
                "price_per_seat": 300.0,
            },
        )
        assert resp.status_code == 400
        assert "future" in resp.json()["detail"].lower()

        # 2. Origin == Destination -> 400
        future_time = datetime.now(timezone.utc) + timedelta(days=2)
        resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_id": vehicle_id,
                "origin": "Bangalore",
                "destination": "Bangalore",
                "departure_at": future_time.isoformat(),
                "available_seats": 2,
                "price_per_seat": 300.0,
            },
        )
        assert resp.status_code == 400
        assert "different" in resp.json()["detail"].lower()

        # 3. Available seats > Vehicle seat capacity (3) -> 400
        resp = await client.post(
            f"{API_PREFIX}/rides",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_id": vehicle_id,
                "origin": "Bangalore",
                "destination": "Chennai",
                "departure_at": future_time.isoformat(),
                "available_seats": 5,
                "price_per_seat": 300.0,
            },
        )
        assert resp.status_code == 400
        assert "capacity" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_messaging_participant_isolation():
    """Phase 12: Only driver and confirmed riders can participate in trip chat."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        driver_token, _, _ = await create_user(client, "msgdrv", "driver")
        rider_token, _, _ = await create_user(client, "msgrdr", "rider")
        outsider_token, _, _ = await create_user(client, "msgout", "rider")

        # Driver creates vehicle and ride
        v_resp = await client.post(
            f"{API_PREFIX}/vehicles",
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "vehicle_type": "car",
                "make": "Ford",
                "model": "EcoSport",
                "registration_number": f"KA{uuid4().int % 100:02d}MS{uuid4().int % 10000:04d}",
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
                "origin": "Koramangala",
                "destination": "Whitefield",
                "departure_at": dep_time.isoformat(),
                "available_seats": 3,
                "price_per_seat": 150.0,
            },
        )
        ride_id = r_resp.json()["id"]

        # Rider books
        await client.post(
            f"{API_PREFIX}/bookings",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"ride_id": ride_id, "seats_booked": 1},
        )

        # Outsider tries to read messages -> 403 Forbidden
        out_get = await client.get(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {outsider_token}"},
        )
        assert out_get.status_code == 403

        # Outsider tries to post message -> 403 Forbidden
        out_post = await client.post(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {outsider_token}"},
            json={"content": "I am an eavesdropper!"},
        )
        assert out_post.status_code == 403

        # Rider posts message -> 201 Created
        r_post = await client.post(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={"content": "Hi Driver, pick me up at Forum Mall."},
        )
        assert r_post.status_code == 201

        # Driver reads message -> 200 OK
        d_get = await client.get(
            f"{API_PREFIX}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {driver_token}"},
        )
        assert d_get.status_code == 200
        assert len(d_get.json()["items"]) == 1


@pytest.mark.asyncio
async def test_admin_route_authorization_and_auditability():
    """Phase 13: Admin endpoints require admin role; report resolutions track auditor."""
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        admin_token, admin_id, _ = await create_user(client, "adminaudit", "admin")
        rider_token, rider_id, _ = await create_user(client, "normalrider", "rider")

        # Rider attempts to view admin stats -> 403 Forbidden
        resp = await client.get(
            f"{API_PREFIX}/admin/stats",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert resp.status_code == 403

        # Admin views stats -> 200 OK
        resp = await client.get(
            f"{API_PREFIX}/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert "total_users" in resp.json()

        # Rider submits an incident report
        report_resp = await client.post(
            f"{API_PREFIX}/safety/reports",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "category": "reckless_driving",
                "description": "Driver was speeding above 120kmph.",
            },
        )
        assert report_resp.status_code == 201
        report_id = report_resp.json()["id"]

        # Admin resolves report
        res_resp = await client.patch(
            f"{API_PREFIX}/admin/reports/{report_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "status": "resolved",
                "admin_notes": "Driver warned and logged in record.",
            },
        )
        assert res_resp.status_code == 200
        report_data = res_resp.json()
        assert report_data["status"] == "resolved"
        assert report_data["resolved_by"] == admin_id
        assert report_data["resolved_at"] is not None
