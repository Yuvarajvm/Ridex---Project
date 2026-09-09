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
USERS_PREFIX = "/api/v1/users"


@pytest.mark.asyncio
async def test_user_profile_lifecycle():
    test_email = f"profile_test_{uuid4().hex[:8]}@ridex.local"
    test_phone = f"+9197{uuid4().int % 100000000:08d}"
    test_password = "SecurePassword123!"

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # 1. Register user
        reg_response = await client.post(
            f"{AUTH_PREFIX}/register",
            json={
                "email": test_email,
                "password": test_password,
                "first_name": "InitialName",
                "last_name": "TestLastName",
                "phone_number": test_phone,
                "role": "rider",
            },
        )
        assert reg_response.status_code == 201
        token = reg_response.json()["access_token"]
        user_id = reg_response.json()["user"]["id"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 2. Get my full details
        me_resp = await client.get(f"{USERS_PREFIX}/me", headers=auth_headers)
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == test_email
        assert me_data["profile"]["first_name"] == "InitialName"

        # 3. Update my profile
        patch_resp = await client.patch(
            f"{USERS_PREFIX}/me/profile",
            json={
                "first_name": "UpdatedFirst",
                "last_name": "UpdatedLast",
                "city": "Hyderabad",
                "bio": "Daily commuter looking for shared rides.",
                "gender": "male",
            },
            headers=auth_headers,
        )
        assert patch_resp.status_code == 200
        patch_data = patch_resp.json()
        assert patch_data["first_name"] == "UpdatedFirst"
        assert patch_data["city"] == "Hyderabad"
        assert patch_data["bio"] == "Daily commuter looking for shared rides."
        assert patch_data["profile_completed_at"] is not None

        # 4. Get public profile (accessible anonymously, no email/phone)
        pub_resp = await client.get(f"{USERS_PREFIX}/{user_id}/public")
        assert pub_resp.status_code == 200
        pub_data = pub_resp.json()
        assert pub_data["first_name"] == "UpdatedFirst"
        assert pub_data["city"] == "Hyderabad"
        assert "email" not in pub_data
        assert "phone_number" not in pub_data

        # 5. Unauthenticated update attempt rejected
        anon_patch = await client.patch(
            f"{USERS_PREFIX}/me/profile",
            json={"first_name": "Hacker"},
        )
        assert anon_patch.status_code == 401
