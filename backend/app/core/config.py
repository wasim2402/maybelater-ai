from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / backend/.env.

    Secrets (database password, Gemini API key) live only here, never in the web app.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "staging", "production"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"
    # auto: readable coloured lines in development, JSON lines everywhere else.
    log_format: Literal["auto", "pretty", "json"] = "auto"

    database_url: str = "postgresql+asyncpg://maybelater@localhost:5432/maybelater"
    test_database_url: str = ""

    # AI suggestions via Google Gemini. Leave the key empty, or set AI_ENABLED=false, to run without them.
    ai_enabled: bool = True
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    # Used when the main model is overloaded, times out or is out of quota. Empty turns fallback off.
    gemini_fallback_model: str = "gemini-2.5-flash"
    # How long the main model gets before the fallback takes over (only when a fallback is set).
    gemini_main_timeout_seconds: float = 15.0
    ai_timeout_seconds: float = 30.0

    # Sessions are issued by Better Auth in the web app. The API verifies its short-lived JWTs with the
    # public keys at AUTH_JWKS_URL (EdDSA). No secret is shared between the apps.
    auth_base_url: str = "http://localhost:3000"  # Better Auth base URL = the token issuer
    auth_jwks_url: str = ""  # default: {auth_base_url}/api/auth/jwks
    auth_audience: str = "maybelater-api"

    # Known web origins only. Accepts a JSON list or a comma-separated string.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # Request body cap for every endpoint (bytes). Capture and AI endpoints add their own limits.
    max_request_bytes: int = Field(default=1_000_000, ge=1_024)

    redis_url: str = "redis://localhost:6379/0"

    # Reminder delivery (docs/REMINDERS.md). The worker runs inside the API process by default; turn it
    # off here and run `python -m app.worker` instead when the API runs as several processes.
    reminder_worker_enabled: bool = True
    reminder_worker_interval_seconds: float = Field(default=20.0, ge=1.0, le=300.0)

    # Web Push (reminder notifications that arrive with the app closed). Generate the pair once with
    # `python scripts/generate_vapid_keys.py`; the private key is a secret and stays on the server.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    # Contact for push services (RFC 8292). A mailto: or https: URL you control; not a user's address.
    vapid_subject: str = "mailto:notifications@maybelater.example"

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
        if not self.auth_jwks_url:
            self.auth_jwks_url = f"{self.auth_base_url.rstrip('/')}/api/auth/jwks"
        if self.app_env in ("staging", "production"):
            if not (self.auth_base_url.startswith("https://") and self.auth_jwks_url.startswith("https://")):
                raise ValueError("AUTH_BASE_URL and AUTH_JWKS_URL must use https outside development")
            if any(o.startswith("http://") and "localhost" not in o for o in self.cors_origins):
                raise ValueError("CORS_ORIGINS must use https outside development")
        return self

    @property
    def push_configured(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def ai_configured(self) -> bool:
        return self.ai_enabled and bool(self.gemini_api_key and self.gemini_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
