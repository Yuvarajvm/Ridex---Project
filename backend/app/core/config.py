"""Application settings loaded from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the RIDEX API."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        env_prefix="RIDEX_",
        extra="ignore",
    )

    app_name: str = "RIDEX"
    app_version: str = "0.1.0"

    environment: Literal[
        "development",
        "test",
        "staging",
        "production",
    ] = "development"

    debug: bool = False

    api_v1_prefix: str = "/api/v1"

    database_url: PostgresDsn

    sql_echo: bool = False

    jwt_secret_key: str = Field(min_length=32)

    jwt_algorithm: str = "HS256"

    access_token_expire_minutes: int = Field(
        default=30,
        gt=0,
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
    )

    storage_bucket: str | None = None

    email_provider: Literal["console", "smtp"] = "console"
    email_host: str = "localhost"
    email_port: int = 587
    email_username: str = ""
    email_password: str = ""
    email_from: str = "noreply@ridex.com"
    email_use_tls: bool = True

    @property
    def is_production(self) -> bool:
        """Return whether RIDEX is running in production."""
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """
    Return one validated settings instance for the running process.

    Caching prevents repeatedly parsing environment configuration.
    """
    return Settings()