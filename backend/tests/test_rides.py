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