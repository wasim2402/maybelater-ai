"""Verifies the web app's session tokens independently of the browser.

The browser sends `Authorization: Bearer <jwt>`. The JWT is minted by Better Auth (web app,
GET /api/auth/token) and signed with an Ed25519 private key that only the web server holds. Here we:
  1. read the key id (`kid`) from the token header and fetch the matching public key from the JWKS
     endpoint (cached; refetched when an unknown `kid` appears, e.g. after key rotation);
  2. verify the signature with EdDSA only (no `alg` switching, no `none`, no HMAC);
  3. require `exp`, `iat` and `sub`, and check issuer and audience.
The verified `sub` is the identity. A user id in a request body is never trusted.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Protocol

import jwt
from jwt import PyJWKClient, PyJWKClientError

from app.core.config import Settings
from app.core.errors import UnauthenticatedError

ALLOWED_ALGORITHMS = ["EdDSA"]
LEEWAY_SECONDS = 30


@dataclass(frozen=True)
class VerifiedToken:
    subject: str
    email: str | None
    name: str | None


class KeyResolver(Protocol):
    def key_for(self, token: str) -> Any: ...


class JwksKeyResolver:
    """Public keys from the Better Auth JWKS endpoint, cached for 5 minutes."""

    def __init__(self, jwks_url: str) -> None:
        self._client = PyJWKClient(jwks_url, cache_keys=True, lifespan=300, timeout=5)

    def key_for(self, token: str) -> Any:
        return self._client.get_signing_key_from_jwt(token).key


class TokenVerifier:
    def __init__(self, resolver: KeyResolver, *, issuer: str, audience: str) -> None:
        self._resolver = resolver
        self._issuer = issuer.rstrip("/")
        self._audience = audience

    @classmethod
    def from_settings(cls, settings: Settings) -> TokenVerifier:
        return cls(JwksKeyResolver(settings.auth_jwks_url), issuer=settings.auth_base_url, audience=settings.auth_audience)

    async def verify(self, token: str) -> VerifiedToken:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise UnauthenticatedError() from exc
        if header.get("alg") not in ALLOWED_ALGORITHMS:
            raise UnauthenticatedError()

        try:
            # The JWKS fetch is blocking network I/O: keep it off the event loop.
            key = await asyncio.to_thread(self._resolver.key_for, token)
        except (PyJWKClientError, jwt.PyJWTError) as exc:
            raise UnauthenticatedError() from exc

        try:
            claims = jwt.decode(
                token,
                key,
                algorithms=ALLOWED_ALGORITHMS,
                audience=self._audience,
                issuer=self._issuer,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "sub"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise UnauthenticatedError("Your session has ended. Sign in again.") from exc
        except jwt.PyJWTError as exc:
            raise UnauthenticatedError() from exc

        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject or len(subject) > 255:
            raise UnauthenticatedError()
        email = claims.get("email") if isinstance(claims.get("email"), str) else None
        name = claims.get("name") if isinstance(claims.get("name"), str) else None
        return VerifiedToken(subject=subject, email=email, name=name)


def bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise UnauthenticatedError()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise UnauthenticatedError()
    return token.strip()
