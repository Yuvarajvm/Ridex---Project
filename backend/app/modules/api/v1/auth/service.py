"""Business logic for authentication operations."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, AuthorizationError, ConflictError, NotFoundError
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.api.v1.auth.repository import AuthRepository
from app.modules.api.v1.auth.schemas import LoginRequest, RegisterRequest
from app.modules.api.v1.users.models import Profile, User


class AuthService:
    """Service orchestrating user registration, authentication, and token generation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = AuthRepository(session)
        self.settings = get_settings()

    async def register(self, payload: RegisterRequest) -> tuple[User, str, int]:
        """Register a new user account with profile and return access token."""
        normalized_email = payload.email.strip().lower()

        existing_user = await self.repository.get_by_email(normalized_email)
        if existing_user is not None:
            raise ConflictError("An account with this email already exists.")

        hashed_password = hash_password(payload.password)
        user_id = uuid4()

        user = User(
            id=user_id,
            email=normalized_email,
            phone_number=payload.phone_number.strip() if payload.phone_number else None,
            password_hash=hashed_password,
            role=payload.role,
            status="active",
        )

        profile = Profile(
            id=uuid4(),
            user_id=user_id,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip() if payload.last_name else None,
            display_name=payload.first_name.strip(),
        )

        try:
            user = await self.repository.create_user_with_profile(user, profile)
            await self.session.commit()
        except IntegrityError as err:
            await self.session.rollback()
            err_msg = str(err)
            if "ix_users_phone_number_active_unique" in err_msg:
                raise ConflictError("An account with this phone number already exists.") from err
            if "ix_users_email_active_unique" in err_msg:
                raise ConflictError("An account with this email already exists.") from err
            raise ConflictError("A user with these details already exists.") from err

        token = create_access_token(
            subject=str(user.id),
            additional_claims={"email": user.email, "role": user.role},
        )
        expires_in = self.settings.access_token_expire_minutes * 60

        return user, token, expires_in

    async def authenticate(self, payload: LoginRequest) -> tuple[User, str, int]:
        """Verify user credentials and issue an access token."""
        normalized_email = payload.email.strip().lower()

        user = await self.repository.get_by_email(normalized_email)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise AuthenticationError("Invalid email or password.")

        if user.status != "active":
            raise AuthorizationError("Account is not active.")

        await self.repository.update_last_login(user.id)
        await self.session.commit()

        token = create_access_token(
            subject=str(user.id),
            additional_claims={"email": user.email, "role": user.role},
        )
        expires_in = self.settings.access_token_expire_minutes * 60

        return user, token, expires_in

    async def get_me(self, user_id: UUID) -> User:
        """Fetch current authenticated user with profile details."""
        user = await self.repository.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        return user
