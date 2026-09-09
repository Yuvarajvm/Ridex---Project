"""Tests for Safety and Admin moderation modules."""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main_module

API_PREFIX = "/api/v1"


async def create_user(client: AsyncClient, role: str = "rider") -> tuple[str, str]:
    """Helper to create and log in a user with a given role."""
    from app.core.database import AsyncSessionFactory
    from sqlalchemy import update
    from app.modules.api.v1.users.models import User

    uid = uuid4().hex[:8]
    email = f"{role}_{uid}@example.com"
    phone = f"+9198{uuid4().int % 100000000:08d}"

    reg_resp = await client.post(
        f"{API_PREFIX}/auth/register",
        json={
            "email": email,
            "phone_number": phone,
            "password": "SecurePassword123!",
            "first_name": "Test",
            "last_name": role.capitalize(),
            "role": "rider" if role == "admin" else role,
        },
    )
    assert reg_resp.status_code == 201
    user_id = reg_resp.json()["user"]["id"]

    if role == "admin":
        from uuid import UUID
        async with AsyncSessionFactory() as session:
            await session.execute(
                update(User).where(User.id == UUID(user_id)).values(role="admin")
            )
            await session.commit()

    login_resp = await client.post(
        f"{API_PREFIX}/auth/login",
        json={"email": email, "password": "SecurePassword123!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return token, user_id


@pytest.mark.asyncio
async def test_safety_report_submission_and_my_reports():
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        rider_token, rider_id = await create_user(client, role="rider")

        # Submit an incident report
        report_payload = {
            "category": "safety",
            "description": "Driver was using mobile phone repeatedly while driving on the highway.",
        }
        create_resp = await client.post(
            f"{API_PREFIX}/safety/reports",
            headers={"Authorization": f"Bearer {rider_token}"},
            json=report_payload,
        )
        assert create_resp.status_code == 201
        report = create_resp.json()
        assert report["status"] == "pending"
        assert report["category"] == "safety"
        assert report["reporter_id"] == rider_id

        # List my reports
        my_resp = await client.get(
            f"{API_PREFIX}/safety/reports/my",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert my_resp.status_code == 200
        items = my_resp.json()["items"]
        assert len(items) >= 1
        assert any(r["id"] == report["id"] for r in items)


@pytest.mark.asyncio
async def test_admin_role_authorization_guards():
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        rider_token, rider_id = await create_user(client, role="rider")

        # Non-admin access to admin endpoints should return 403 Forbidden
        stats_resp = await client.get(
            f"{API_PREFIX}/admin/stats",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert stats_resp.status_code == 403

        reports_resp = await client.get(
            f"{API_PREFIX}/admin/reports",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert reports_resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_full_workflow():
    transport = ASGITransport(app=main_module.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create rider and submit report
        rider_token, rider_id = await create_user(client, role="rider")
        report_resp = await client.post(
            f"{API_PREFIX}/safety/reports",
            headers={"Authorization": f"Bearer {rider_token}"},
            json={
                "category": "conduct",
                "description": "Unprofessional communication regarding pickup delay.",
            },
        )
        report_id = report_resp.json()["id"]

        # Create admin user
        admin_token, admin_id = await create_user(client, role="admin")

        # 1. Admin reads platform stats
        stats_resp = await client.get(
            f"{API_PREFIX}/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert stats_resp.status_code == 200
        stats = stats_resp.json()
        assert stats["total_users"] >= 2
        assert stats["open_reports_count"] >= 1

        # 2. Admin lists reports
        list_resp = await client.get(
            f"{API_PREFIX}/admin/reports?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert list_resp.status_code == 200
        assert any(r["id"] == report_id for r in list_resp.json()["items"])

        # 3. Admin updates report to resolved
        patch_resp = await client.patch(
            f"{API_PREFIX}/admin/reports/{report_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "status": "resolved",
                "admin_notes": "Contacted both parties and provided safety warning.",
            },
        )
        assert patch_resp.status_code == 200
        updated_report = patch_resp.json()
        assert updated_report["status"] == "resolved"
        assert updated_report["admin_notes"] == "Contacted both parties and provided safety warning."
        assert updated_report["resolved_by"] == admin_id

        # 4. Admin suspends rider account
        suspend_resp = await client.patch(
            f"{API_PREFIX}/admin/users/{rider_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "suspended"},
        )
        assert suspend_resp.status_code == 200
        assert suspend_resp.json()["status"] == "suspended"

        # 5. Suspended rider tries to access protected endpoints -> 403 Forbidden
        guarded_resp = await client.get(
            f"{API_PREFIX}/notifications",
            headers={"Authorization": f"Bearer {rider_token}"},
        )
        assert guarded_resp.status_code == 403
