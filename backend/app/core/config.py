from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / backend/.env.

    Secrets (database password, OpenAI key, auth secret) live only here, never in the web app.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "staging", "production"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://maybelater@localhost:5432/maybelater"
    test_database_url: str = ""

    openai_api_key: str = ""
    openai_model: str = ""
    ai_timeout_seconds: float = 30.0

    auth_secret: str = ""
    auth_base_url: str = "http://localhost:3000"

    # Known web origins only. Accepts a JSON list or a comma-separated string.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # Request body cap for every endpoint (bytes). Capture and AI endpoints add their own limits.
    max_request_bytes: int = Field(default=1_000_000, ge=1_024)

    redis_url: str = "redis://localhost:6379/0"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                import json

                return json.loads(text)
            return [part.strip() for part in text.split(",") if part.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("CORS_ORIGINS must list known web origins; '*' is not allowed with credentials")
        return [origin.rstrip("/") for origin in value]

    @model_validator(mode="after")
    def _production_requirements(self) -> "Settings":
        if self.app_env in ("staging", "production"):
            if len(self.auth_secret) < 32:
                raise ValueError("AUTH_SECRET must be set (32+ characters) outside development")
            if any(o.startswith("http://") and "localhost" not in o for o in self.cors_origins):
                raise ValueError("CORS_ORIGINS must use https outside development")
        return self

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def ai_configured(self) -> bool:
        return bool(self.openai_api_key and self.openai_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
