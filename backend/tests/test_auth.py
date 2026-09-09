import sys
from pathlib import Path
from uuid import uuid4

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main_module

API_PREFIX = "/api/v1/auth"


@pytest.mark.asyncio
async def test_register_and_login_flow():
    test_email = f"rider_{uuid4().hex[:8]}@ridex.local"
    test_phone = f"+9198{uuid4().int % 100000000:08d}"
    test_password = "SecurePassword123!"

    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # 1. Register
        register_payload = {
            "email": test_email,
            "password": test_password,
            "first_name": "Yuva",
            "last_name": "Raj",
            "phone_number": test_phone,
            "role": "rider",
        }
        reg_response = await client.post(f"{API_PREFIX}/register", json=register_payload)
        assert reg_response.status_code == 201, reg_response.text
        reg_data = reg_response.json()
        assert "access_token" in reg_data
        assert reg_data["user"]["email"] == test_email
        assert reg_data["user"]["profile"]["first_name"] == "Yuva"

        token = reg_data["access_token"]

        # 2. Duplicate registration rejected
        dup_response = await client.post(f"{API_PREFIX}/register", json=register_payload)
        assert dup_response.status_code == 409
        assert "already exists" in dup_response.json()["detail"].lower()

        # 3. Get /me with valid token
        me_response = await client.get(
            f"{API_PREFIX}/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["email"] == test_email
        assert me_data["profile"]["first_name"] == "Yuva"

        # 4. Login with correct credentials
        login_response = await client.post(
            f"{API_PREFIX}/login",
            json={"email": test_email, "password": test_password},
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert "access_token" in login_data
        assert login_data["user"]["email"] == test_email

        # 5. Login with wrong password
        bad_pw_response = await client.post(
            f"{API_PREFIX}/login",
            json={"email": test_email, "password": "WrongPassword123!"},
        )
        assert bad_pw_response.status_code == 401

        # 6. Login with nonexistent email
        no_user_response = await client.post(
            f"{API_PREFIX}/login",
            json={"email": "nonexistent@ridex.local", "password": test_password},
        )
        assert no_user_response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_unauthorized():
    async with AsyncClient(
        transport=ASGITransport(app=main_module.app),
        base_url="http://test",
    ) as client:
        # No header
        resp1 = await client.get(f"{API_PREFIX}/me")
        assert resp1.status_code == 401

        # Invalid token
        resp2 = await client.get(
            f"{API_PREFIX}/me",
            headers={"Authorization": "Bearer invalid.token.value"},
        )
        assert resp2.status_code == 401
