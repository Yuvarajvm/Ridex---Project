"""User identity and profile persistence models."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.api.v1.vehicles.models import Vehicle


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Account identity, credentials, and security lifecycle state.
    """

    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "email = lower(trim(email))",
            name="ck_users_email_normalized",
        ),
        CheckConstraint(
            "length(trim(email)) > 0",
            name="ck_users_email_nonempty",
        ),
        CheckConstraint(
            "length(trim(password_hash)) > 0",
            name="ck_users_password_hash_nonempty",
        ),
        CheckConstraint(
            "failed_login_attempts >= 0",
            name="ck_users_failed_login_attempts_nonnegative",
        ),
        CheckConstraint(
            "role IN ('rider', 'driver', 'admin')",
            name="ck_users_role",
        ),
        CheckConstraint(
            "status IN ('pending_verification', 'active', 'suspended', 'deactivated')",
            name="ck_users_status",
        ),
        CheckConstraint(
            "NOT (status = 'active' AND deleted_at IS NOT NULL)",
            name="ck_users_active_requires_not_deleted",
        ),
        Index(
            "ix_users_email_active_unique",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_users_phone_number_active_unique",
            "phone_number",
            unique=True,
            postgresql_where=text(
                "phone_number IS NOT NULL AND deleted_at IS NULL"
            ),
        ),
        Index(
            "ix_users_status",
            "status",
        ),
        Index(
            "ix_users_role",
            "role",
        ),
        Index(
            "ix_users_created_at",
            "created_at",
        ),
    )

    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="rider",
        server_default="rider",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending_verification",
        server_default="pending_verification",
    )

    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    phone_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    failed_login_attempts: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
        server_default="0",
    )

    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    profile: Mapped[Profile | None] = relationship(
        back_populates="user",
        uselist=False,
    )

    vehicles: Mapped[list[Vehicle]] = relationship(
        back_populates="owner",
    )


class Profile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Personal and onboarding information kept separate from account credentials.

    A user has exactly one profile record throughout its lifecycle.
    """

    __tablename__ = "profiles"

    __table_args__ = (
        CheckConstraint(
            "length(trim(first_name)) > 0",
            name="ck_profiles_first_name_nonempty",
        ),
        CheckConstraint(
            "display_name IS NULL OR length(trim(display_name)) > 0",
            name="ck_profiles_display_name_nonempty",
        ),
        CheckConstraint(
            "gender IS NULL OR gender IN "
            "('male', 'female', 'non_binary', 'prefer_not_to_say')",
            name="ck_profiles_gender",
        ),
        Index(
            "ux_profiles_user_id",
            "user_id",
            unique=True,
        ),
        Index(
            "ix_profiles_city",
            "city",
        ),
        Index(
            "ix_profiles_state",
            "state",
        ),
        Index(
            "ix_profiles_created_at",
            "created_at",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    display_name: Mapped[str | None] = mapped_column(
        String(160),
        nullable=True,
    )

    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    bio: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    gender: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    city: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    state: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    country: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="India",
        server_default="India",
    )

    profile_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user: Mapped[User] = relationship(
        back_populates="profile",
    )