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
        default_factory=list,
    )

    storage_bucket: str | None = None

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