"""HTTP routes for authentication and current-user identity."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.api.v1.auth.dependencies import get_current_user
from app.modules.api.v1.auth.schemas import (
    AuthUserResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.modules.api.v1.auth.service import AuthService
from app.modules.api.v1.users.models import User

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new rider or driver account",
)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Register account, persist credentials, and issue initial access token."""
    service = AuthService(session)
    user, token, expires_in = await service.register(payload)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=AuthUserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Log in with email and password",
)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Validate credentials and issue an access token."""
    service = AuthService(session)
    user, token, expires_in = await service.authenticate(payload)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=AuthUserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=AuthUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> AuthUserResponse:
    """Return the profile and account details of the authenticated caller."""
    return AuthUserResponse.model_validate(current_user)


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Request a password reset email",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    """
    Initiate the password reset flow.

    Always returns 200 OK regardless of whether the email exists,
    to prevent email enumeration attacks.
    """
    service = AuthService(session)
    await service.forgot_password(payload.email)
    return MessageResponse(
        message="If an account with this email exists, a password reset link has been sent."
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset password using token from email",
)
async def reset_password(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    """Complete the password reset flow using a valid, unexpired token."""
    service = AuthService(session)
    await service.reset_password(payload.token, payload.new_password)
    return MessageResponse(message="Your password has been reset successfully.")
