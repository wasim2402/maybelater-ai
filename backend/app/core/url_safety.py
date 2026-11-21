"""URL checks before the server ever fetches a user-supplied link (SSRF protection).

`validate_capture_url` checks the shape only (scheme, host, length): use it when a link is saved.
`resolve_public_url` also resolves the host and rejects private, loopback, link-local, reserved
and multicast addresses: call it immediately before any server-side fetch (stage 07), and fetch
without following redirects to unchecked hosts.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

from app.core.errors import UnsafeUrlError

MAX_URL_LENGTH = 2048
_ALLOWED_SCHEMES = {"http", "https"}
_BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain", "metadata.google.internal"}
_BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home.arpa")


def _is_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not (ip.is_multicast or ip.is_reserved or ip.is_loopback or ip.is_link_local)


def validate_capture_url(url: str) -> str:
    """Returns the trimmed URL, or raises UnsafeUrlError. No network access."""
    url = url.strip()
    if len(url) > MAX_URL_LENGTH:
        raise UnsafeUrlError("That link is too long to save.")
    try:
        parts = urlsplit(url)
        port = parts.port  # raises ValueError for a bad port
    except ValueError as exc:
        raise UnsafeUrlError("That does not look like a valid link.") from exc
    if parts.scheme.lower() not in _ALLOWED_SCHEMES:
        raise UnsafeUrlError()
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise UnsafeUrlError("That does not look like a valid link.")
    if parts.username or parts.password:
        raise UnsafeUrlError("Links with a username or password cannot be saved.")
    if host in _BLOCKED_HOSTNAMES or host.endswith(_BLOCKED_SUFFIXES):
        raise UnsafeUrlError()
    if port is not None and port not in (80, 443) and port < 1024:
        raise UnsafeUrlError()
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None and not _is_public_ip(literal):
        raise UnsafeUrlError()
    return url


async def resolve_public_url(url: str) -> str:
    """Shape check plus DNS: every address the host resolves to must be public."""
    url = validate_capture_url(url)
    parts = urlsplit(url)
    host = parts.hostname or ""
    port = parts.port or (443 if parts.scheme.lower() == "https" else 80)
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeUrlError("We could not reach that link's address.") from exc
    addresses = {info[4][0] for info in infos}
    if not addresses or not all(_is_public_ip(ipaddress.ip_address(a.split("%")[0])) for a in addresses):
        raise UnsafeUrlError()
    return url
