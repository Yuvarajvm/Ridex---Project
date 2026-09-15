"""CLI utility to create or promote an admin account in RIDEX."""

import asyncio
import sys
from uuid import uuid4

import app.shared.models
from app.core.database import AsyncSessionFactory
from app.core.security import hash_password
from app.modules.api.v1.users.models import Profile, User
from sqlalchemy import select


async def create_or_promote_admin(email: str = "admin@ridex.com", password: str = "AdminPass123!"):
    email = email.strip().lower()
    async with AsyncSessionFactory() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            user.role = "admin"
            user.status = "active"
            if password:
                user.password_hash = hash_password(password)
            await session.commit()
            print(f"SUCCESS: Existing user '{email}' promoted to 'admin' with updated credentials.")
        else:
            user_id = uuid4()
            user = User(
                id=user_id,
                email=email,
                password_hash=hash_password(password),
                role="admin",
                status="active",
            )
            profile = Profile(
                id=uuid4(),
                user_id=user_id,
                first_name="RIDEX",
                last_name="Administrator",
                display_name="Admin",
            )
            session.add(user)
            session.add(profile)
            await session.commit()
            print(f"SUCCESS: Created new admin user '{email}' with password '{password}'.")


if __name__ == "__main__":
    target_email = sys.argv[1] if len(sys.argv) > 1 else "admin@ridex.com"
    target_pass = sys.argv[2] if len(sys.argv) > 2 else "AdminPass123!"
    asyncio.run(create_or_promote_admin(target_email, target_pass))
