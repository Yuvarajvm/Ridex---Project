import sys
from pathlib import Path
from uuid import uuid4

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main_module

AUTH_PREFIX = "/api/v1/auth"
VEHICLES_PREFIX = "/api/v1/vehicles"


@pytest.mark.asyncio
async def test_vehicle_lifecycle_and_ownership():
    user_a_email = f"driver_a_{uuid4().hex[:8]}@ridex.local"
    user_b_email = f"driver_b_{uuid4().hex[:8]}@ridex.local"
    reg_num = f"AP39AB{uuid4().int % 9000 + 1000}"

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # 1. Register Driver A
        resp_a = await client.post(
            f"{AUTH_PREFIX}/register",
            json={
                "email": user_a_email,
                "password": "Password123!",
                "first_name": "DriverA",
                "role": "driver",
            },
        )
        assert resp_a.status_code == 201
        token_a = resp_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Register Driver B
        resp_b = await client.post(
            f"{AUTH_PREFIX}/register",
            json={
                "email": user_b_email,
                "password": "Password123!",
                "first_name": "DriverB",
                "role": "driver",
            },
        )
        assert resp_b.status_code == 201
        token_b = resp_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 3. Driver A creates a vehicle
        vehicle_payload = {
            "vehicle_type": "car",
            "make": "Toyota",
            "model": "Etios",
            "color": "White",
            "registration_number": reg_num,
            "manufacture_year": 2022,
            "seat_capacity": 4,
        }
        create_resp = await client.post(
            f"{VEHICLES_PREFIX}",
            json=vehicle_payload,
            headers=headers_a,
        )
        assert create_resp.status_code == 201, create_resp.text
        vehicle_a_data = create_resp.json()
        vehicle_a_id = vehicle_a_data["id"]
        assert vehicle_a_data["registration_number"] == reg_num
        assert vehicle_a_data["seat_capacity"] == 4

        # 4. Duplicate registration rejected
        dup_resp = await client.post(
            f"{VEHICLES_PREFIX}",
            json=vehicle_payload,
            headers=headers_a,
        )
        assert dup_resp.status_code == 409

        # 5. List vehicles for Driver A
        list_a = await client.get(f"{VEHICLES_PREFIX}", headers=headers_a)
        assert list_a.status_code == 200
        assert list_a.json()["total"] >= 1

        # 6. List vehicles for Driver B (should not include Driver A's vehicle)
        list_b = await client.get(f"{VEHICLES_PREFIX}", headers=headers_b)
        assert list_b.status_code == 200
        assert list_b.json()["total"] == 0

        # 7. Driver B tries to update Driver A's vehicle -> 403 Forbidden
        hack_resp = await client.patch(
            f"{VEHICLES_PREFIX}/{vehicle_a_id}",
            json={"color": "Black"},
            headers=headers_b,
        )
        assert hack_resp.status_code == 403

        # 8. Driver B tries to delete Driver A's vehicle -> 403 Forbidden
        hack_del = await client.delete(
            f"{VEHICLES_PREFIX}/{vehicle_a_id}",
            headers=headers_b,
        )
        assert hack_del.status_code == 403

        # 9. Driver A updates their own vehicle
        update_resp = await client.patch(
            f"{VEHICLES_PREFIX}/{vehicle_a_id}",
            json={"color": "Silver"},
            headers=headers_a,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["color"] == "Silver"

        # 10. Driver A deletes their vehicle
        del_resp = await client.delete(
            f"{VEHICLES_PREFIX}/{vehicle_a_id}",
            headers=headers_a,
        )
        assert del_resp.status_code == 204

        # 11. Listing Driver A's vehicles shows 0 active
        list_a_after = await client.get(f"{VEHICLES_PREFIX}", headers=headers_a)
        assert list_a_after.status_code == 200
        assert list_a_after.json()["total"] == 0
