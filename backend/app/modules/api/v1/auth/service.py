"""Business logic for authentication operations."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email import EmailService
from app.core.exceptions import AuthenticationError, AuthorizationError, ConflictError, NotFoundError
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.api.v1.auth.models import PasswordResetToken
from app.modules.api.v1.auth.repository import AuthRepository
from app.modules.api.v1.auth.schemas import LoginRequest, RegisterRequest
from app.modules.api.v1.users.models import Profile, User

logger = logging.getLogger(__name__)

RESET_TOKEN_EXPIRY_MINUTES = 15


class AuthService:
    """Service orchestrating user registration, authentication, and token generation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = AuthRepository(session)
        self.settings = get_settings()

    async def register(self, payload: RegisterRequest) -> tuple[User, str, int]:
        """Register a new user account with profile and return access token."""
        normalized_email = payload.email.strip().lower()

        # Prevent admin self-registration via API
        if payload.role not in ("rider", "driver"):
            raise AuthorizationError("Invalid role. Only 'rider' and 'driver' are allowed.")

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

    async def forgot_password(self, email: str) -> None:
        """
        Generate a secure password reset token and send reset email.

        Always returns success to prevent email enumeration.
        """
        normalized_email = email.strip().lower()
        user = await self.repository.get_by_email(normalized_email)

        if user is None:
            # Do not reveal whether the email exists
            logger.info("Password reset requested for non-existent email (suppressed)")
            return

        # Invalidate any existing unused tokens for this user
        now = datetime.now(timezone.utc)
        await self.session.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=now)
        )

        # Generate secure random token
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        reset_token = PasswordResetToken(
            id=uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=now + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES),
        )
        self.session.add(reset_token)
        await self.session.commit()

        # Send email with the raw token (never store the raw token)
        reset_url = f"http://localhost:5173/reset-password?token={raw_token}"
        email_service = EmailService.create()
        await email_service.send_password_reset(normalized_email, reset_url)

    async def reset_password(self, raw_token: str, new_password: str) -> None:
        """
        Complete password reset using a valid, unexpired, single-use token.
        """
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        now = datetime.now(timezone.utc)

        # Find valid token
        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
        result = await self.session.execute(stmt)
        reset_token = result.scalar_one_or_none()

        if reset_token is None:
            raise AuthenticationError(
                "Invalid or expired reset token. Please request a new password reset."
            )

        # Mark token as used
        reset_token.used_at = now

        # Update password
        user = await self.repository.get_by_id(reset_token.user_id)
        if user is None:
            raise NotFoundError("User account not found.")

        user.password_hash = hash_password(new_password)
        await self.session.commit()

        logger.info("Password reset completed for user %s", reset_token.user_id)
