"""Fetches a few safe facts about a saved link (title, description, site name) to help analysis.

Guarded against misuse of the server (SSRF) and against heavy pages:
- every URL, including each redirect target, must resolve only to public addresses;
- at most 3 redirects, 5 s overall, 512 KB read, HTML only;
- no cookies or credentials are sent, and nothing behind a login or paywall is attempted;
- only the metadata is kept; the page body is discarded and never stored or logged.
Any problem returns None: analysis then works from the URL alone.
"""

from __future__ import annotations

import asyncio
import logging
from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx

from app.core.errors import UnsafeUrlError
from app.core.url_safety import resolve_public_url
from app.services.ai.prompts import PageMetadata

logger = logging.getLogger("app.page_metadata")

MAX_BYTES = 512 * 1024
MAX_REDIRECTS = 3
TIMEOUT_SECONDS = 5.0
USER_AGENT = "MaybeLaterBot/0.1 (+link preview; reads page title and description only)"


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self._in_title = False
        self.title_text = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            if key in {"og:title", "og:description", "og:site_name", "description", "twitter:title", "twitter:description"}:
                self.meta.setdefault(key, values.get("content", ""))

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title and len(self.title_text) < 500:
            self.title_text += data


def _clean(value: str | None, limit: int) -> str | None:
    if not value:
        return None
    value = " ".join(value.split())
    return value[:limit] or None


def parse_metadata(html: str) -> PageMetadata:
    parser = _MetaParser()
    try:
        parser.feed(html)
    except Exception:  # noqa: BLE001 - broken markup: keep what was parsed
        pass
    meta = parser.meta
    return PageMetadata(
        title=_clean(meta.get("og:title") or meta.get("twitter:title") or parser.title_text, 200),
        description=_clean(meta.get("og:description") or meta.get("description") or meta.get("twitter:description"), 500),
        site_name=_clean(meta.get("og:site_name"), 80),
    )


async def fetch_page_metadata(url: str, client: httpx.AsyncClient | None = None) -> PageMetadata | None:
    owns_client = client is None
    client = client or httpx.AsyncClient(
        follow_redirects=False,
        timeout=httpx.Timeout(TIMEOUT_SECONDS, connect=3.0),
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    )
    try:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            current = url
            for _ in range(MAX_REDIRECTS + 1):
                await resolve_public_url(current)  # raises UnsafeUrlError for private/loopback targets
                async with client.stream("GET", current) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            return None
                        current = urljoin(current, location)
                        continue
                    if response.status_code != 200:
                        return None
                    if "html" not in response.headers.get("content-type", "").lower():
                        return None
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) >= MAX_BYTES:
                            break
                    encoding = response.charset_encoding or "utf-8"
                    return parse_metadata(bytes(body[:MAX_BYTES]).decode(encoding, errors="replace"))
            return None  # too many redirects
    except UnsafeUrlError:
        logger.info("page metadata skipped: unsafe target")
        return None
    except (httpx.HTTPError, TimeoutError, LookupError, UnicodeError):
        return None
    finally:
        if owns_client:
            await client.aclose()
