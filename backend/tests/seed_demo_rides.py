"""Seed realistic demo data for the RIDEX ride marketplace."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.users.models import User
from app.modules.api.v1.vehicles.models import Vehicle


async def seed_demo_data() -> None:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        # ---------------------------------------------------------
        # Demo driver
        # ---------------------------------------------------------
        result = await session.execute(
            select(User).where(
                User.email == "demo.driver@ridex.local",
                User.deleted_at.is_(None),
            )
        )
        driver = result.scalar_one_or_none()

        if driver is None:
            driver = User(
                id=uuid4(),
                email="demo.driver@ridex.local",
                password_hash="demo-only-not-for-authentication",
                role="driver",
                status="active",
            )
            session.add(driver)
            await session.flush()

        # ---------------------------------------------------------
        # Demo vehicle
        # ---------------------------------------------------------
        result = await session.execute(
            select(Vehicle).where(
                Vehicle.owner_id == driver.id,
                Vehicle.deleted_at.is_(None),
            )
        )
        vehicle = result.scalar_one_or_none()

        if vehicle is None:
            vehicle = Vehicle(
                id=uuid4(),
                owner_id=driver.id,
                vehicle_type="car",
                registration_number="AP39AB1234",
                make="Toyota",
                model="Etios",
                manufacture_year=2022,
                seat_capacity=4,
                verification_status="verified",
                verified_at=datetime.now(timezone.utc),
                is_active=True,
            )
            session.add(vehicle)
            await session.flush()

        # ---------------------------------------------------------
        # Demo rides
        # ---------------------------------------------------------
        result = await session.execute(
            select(Ride).where(
                Ride.driver_id == driver.id,
                Ride.deleted_at.is_(None),
            )
        )
        existing_rides = list(result.scalars().all())

        if not existing_rides:
            now = datetime.now(timezone.utc)

            rides = [
                Ride(
                    id=uuid4(),
                    driver_id=driver.id,
                    vehicle_id=vehicle.id,
                    origin="Nandyal",
                    destination="Kurnool",
                    departure_at=now + timedelta(days=1, hours=3),
                    available_seats=3,
                    price_per_seat=Decimal("180.00"),
                    status="scheduled",
                    notes="Comfortable ride. One small bag per passenger.",
                ),
                Ride(
                    id=uuid4(),
                    driver_id=driver.id,
                    vehicle_id=vehicle.id,
                    origin="Nandyal",
                    destination="Hyderabad",
                    departure_at=now + timedelta(days=2, hours=5),
                    available_seats=2,
                    price_per_seat=Decimal("650.00"),
                    status="scheduled",
                    notes="Morning departure. AC available.",
                ),
                Ride(
                    id=uuid4(),
                    driver_id=driver.id,
                    vehicle_id=vehicle.id,
                    origin="Kurnool",
                    destination="Nandyal",
                    departure_at=now + timedelta(days=3, hours=2),
                    available_seats=3,
                    price_per_seat=Decimal("180.00"),
                    status="scheduled",
                    notes="Return journey.",
                ),
            ]

            session.add_all(rides)

        await session.commit()

        print("RIDEX demo data seeded successfully.")
        print(f"Driver ID:  {driver.id}")
        print(f"Vehicle ID: {vehicle.id}")

        result = await session.execute(
            select(Ride)
            .where(
                Ride.driver_id == driver.id,
                Ride.deleted_at.is_(None),
            )
            .order_by(Ride.departure_at)
        )

        rides = list(result.scalars().all())

        print(f"Rides:      {len(rides)}")

        for ride in rides:
            print(
                f"- {ride.origin} -> {ride.destination} | "
                f"{ride.departure_at.isoformat()} | "
                f"{ride.available_seats} seats | "
                f"INR {ride.price_per_seat}"
            )


if __name__ == "__main__":
    asyncio.run(seed_demo_data())