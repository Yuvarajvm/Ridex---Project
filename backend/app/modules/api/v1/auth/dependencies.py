"""FastAPI dependency injection for authentication and role authorization."""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.exceptions import AuthenticationError, AuthorizationError, NotFoundError
from app.core.security import decode_access_token
from app.modules.api.v1.auth.service import AuthService
from app.modules.api.v1.users.models import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    """Extract and validate JWT bearer token from Authorization header and return current User."""
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Authentication required.")

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub")
    if not subject:
        raise AuthenticationError("Invalid token subject.")

    try:
        user_id = UUID(str(subject))
    except ValueError as err:
        raise AuthenticationError("Malformed user identifier in token.") from err

    service = AuthService(session)
    try:
        user = await service.get_me(user_id)
    except NotFoundError as err:
        raise AuthenticationError("User associated with token no longer exists.") from err

    if user.status != "active":
        raise AuthorizationError("Account is not active.")

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency ensuring current user is active."""
    return current_user


def require_role(*roles: str) -> Callable:
    """Dependency factory restricting endpoint access to specific roles."""

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in roles:
            raise AuthorizationError(f"Action requires one of the following roles: {', '.join(roles)}")
        return current_user

    return role_checker
