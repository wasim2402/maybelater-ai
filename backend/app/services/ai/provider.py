"""The AI provider boundary. Everything that talks to a model goes through `AIProvider`, so the
provider can change without touching routes or business logic. Outputs are validated Pydantic
models, never raw JSON.

Current provider: Google Gemini (google-genai SDK), model from GEMINI_MODEL (default gemini-3.8-flash).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Protocol, TypeVar

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel, ConfigDict, ValidationError
from tenacity import AsyncRetrying, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config import Settings, get_settings
from app.core.errors import ProviderError, ProviderNotConfiguredError

OutputT = TypeVar("OutputT", bound=BaseModel)
logger = logging.getLogger("app.ai")


class ProviderTimeoutError(ProviderError):
    code = "provider_timeout"
    message = "Suggestions took too long. Your item is saved; try again."


class ProviderRateLimitedError(ProviderError):
    code = "provider_rate_limited"
    message = "Suggestions are busy right now. Your item is saved; try again in a minute."


class ProviderUnavailableError(ProviderError):
    code = "provider_unavailable"
    message = "Suggestions are unavailable right now. Your item is saved; try again later."


class ProviderBadOutputError(ProviderError):
    code = "provider_bad_output"
    message = "Suggestions could not be read this time. Your item is saved; try again."


class AIProvider(Protocol):
    name: str
    model: str  # the configured model
    last_model: str  # the model that answered the most recent call (may be a fallback)

    async def structured(self, *, system: str, user: str, output: type[OutputT]) -> OutputT:
        """Runs one structured call and returns a validated `output` instance.
        Raises a ProviderError subclass on timeout, rate limit, outage or malformed output."""
        ...


class UnconfiguredProvider:
    """Used when GEMINI_API_KEY is not set: callers get a clear 503, and capture keeps working
    without analysis."""

    name = "none"
    model = "none"
    last_model = "none"

    async def structured(self, *, system: str, user: str, output: type[OutputT]) -> OutputT:
        raise ProviderNotConfiguredError("Suggestions are not available yet. Your item is saved.")


class _CallTimeout(Exception):
    """Our own deadline for one attempt passed."""


# The SDK's transport errors (google-genai uses httpx at runtime).
_TIMEOUTS = (httpx.TimeoutException,)
_TRANSPORT = (httpx.TransportError,)


def response_schema_for(output: type[OutputT]) -> type[BaseModel]:
    """The schema sent to Gemini: the same fields and descriptions, without `additionalProperties`,
    which not every Gemini API version accepts. The answer is still validated against the strict
    `output` model afterwards."""
    return type(f"{output.__name__}Response", (output,), {"model_config": ConfigDict(extra="ignore")})


def _status(exc: BaseException) -> int | None:
    code = getattr(exc, "code", None)
    return code if isinstance(code, int) else None


def _transient(exc: BaseException) -> bool:
    """Worth another attempt: timeouts, dropped connections, 429 and 5xx. Never other 4xx."""
    if isinstance(exc, (_CallTimeout, *_TIMEOUTS, *_TRANSPORT, genai_errors.ServerError)):
        return True
    return isinstance(exc, genai_errors.ClientError) and _status(exc) == 429


def _capacity_problem(exc: BaseException) -> bool:
    """The model itself could not serve us right now (overload, deadline, quota): another model may."""
    if isinstance(exc, (_CallTimeout, *_TIMEOUTS, genai_errors.ServerError)):
        return True
    return isinstance(exc, genai_errors.ClientError) and _status(exc) == 429


class GeminiProvider:
    """Gemini with structured output: `response_mime_type="application/json"` plus the Pydantic
    model as `response_schema`, so the model must answer in exactly that shape.

    The main model gets one attempt; if it is overloaded, times out or is out of quota, the fallback
    model (GEMINI_FALLBACK_MODEL) takes the request with the usual retries. Configuration problems
    (bad key, unknown model) and malformed answers do not trigger the fallback."""

    name = "gemini"

    def __init__(self, settings: Settings, client: Any | None = None, attempts: int = 3) -> None:
        self.model = settings.gemini_model
        self.fallback_model = settings.gemini_fallback_model if settings.gemini_fallback_model != settings.gemini_model else ""
        self.last_model = self.model
        self._timeout = settings.ai_timeout_seconds
        self._main_timeout = min(settings.gemini_main_timeout_seconds, settings.ai_timeout_seconds) if self.fallback_model else self._timeout
        self._attempts = attempts
        # Retries are ours (only transient failures, with backoff), so none are configured in the SDK.
        self._client = client or genai.Client(
            api_key=settings.gemini_api_key,
            http_options=genai_types.HttpOptions(timeout=int(settings.ai_timeout_seconds * 1000)),
        )

    async def _call(self, model: str, system: str, user: str, output: type[OutputT], timeout: float | None = None) -> Any:
        config = genai_types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=response_schema_for(output),
            temperature=0.2,  # steady, factual suggestions
        )
        try:
            async with asyncio.timeout(timeout or self._timeout):
                return await self._client.aio.models.generate_content(model=model, contents=user, config=config)
        except TimeoutError as exc:
            raise _CallTimeout() from exc

    async def _with_retries(
        self, model: str, attempts: int, system: str, user: str, output: type[OutputT], timeout: float | None = None
    ) -> Any:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(attempts),
            wait=wait_exponential(multiplier=0.5, max=8),
            retry=retry_if_exception(_transient),
            reraise=True,
        ):
            with attempt:
                return await self._call(model, system, user, output, timeout)
        raise AssertionError("unreachable")  # pragma: no cover

    async def structured(self, *, system: str, user: str, output: type[OutputT]) -> OutputT:
        try:
            try:
                attempts = 1 if self.fallback_model else self._attempts
                response = await self._with_retries(self.model, attempts, system, user, output, self._main_timeout)
                self.last_model = self.model
            except Exception as exc:
                if not (self.fallback_model and _capacity_problem(exc)):
                    raise
                logger.info("ai main model unavailable, using fallback", extra={"model": self.model, "fallback": self.fallback_model})
                response = await self._with_retries(self.fallback_model, self._attempts, system, user, output)
                self.last_model = self.fallback_model
        except (_CallTimeout, *_TIMEOUTS) as exc:
            raise ProviderTimeoutError() from exc
        except genai_errors.ClientError as exc:
            if _status(exc) == 429:
                raise ProviderRateLimitedError() from exc
            # 400/401/403/404: a configuration or request problem (bad key, unknown model), not the user's.
            logger.warning("ai provider rejected the request", extra={"status": _status(exc)})
            raise ProviderUnavailableError() from exc
        except (genai_errors.ServerError, *_TRANSPORT) as exc:
            raise ProviderUnavailableError() from exc
        except genai_errors.APIError as exc:
            raise ProviderUnavailableError() from exc

        return self._parse(response, output)

    @staticmethod
    def _parse(response: Any, output: type[OutputT]) -> OutputT:
        """The SDK's parsed object when present, else the JSON text; either way validated by us.
        A safety block, an empty answer or text that does not fit the schema is bad output."""
        parsed = getattr(response, "parsed", None)
        try:
            if isinstance(parsed, BaseModel):
                return output.model_validate(parsed.model_dump())
            if isinstance(parsed, dict):
                return output.model_validate(parsed)
            text = getattr(response, "text", None)
            if not text:
                raise ProviderBadOutputError()
            return output.model_validate_json(text)
        except ValidationError as exc:
            raise ProviderBadOutputError() from exc


def get_ai_provider(settings: Settings | None = None) -> AIProvider:
    settings = settings or get_settings()
    if not settings.ai_configured:
        return UnconfiguredProvider()
    return GeminiProvider(settings)
