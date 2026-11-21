import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { API_BASE, api, setUnauthenticatedHandler } from "./client";
import { ApiError } from "./errors";
import { setTokenFetcher } from "./token";

/** A JWT-shaped token whose payload expires in `secondsLeft`. */
function fakeToken(name: string, secondsLeft = 900) {
  const payload = btoa(JSON.stringify({ sub: name, exp: Math.floor(Date.now() / 1000) + secondsLeft }));
  return `header.${payload}.sig-${name}`;
}

let tokens: string[] = [];
beforeEach(() => {
  tokens = [fakeToken("t1"), fakeToken("t2")];
  setTokenFetcher(async () => tokens.shift() ?? null);
  setUnauthenticatedHandler(null);
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", ...init.headers }, status: init.status ?? 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("calls /api/v1 with a bearer token and query params, and validates the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok", environment: "development" }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await api.get("/health", {
      query: { q: "ramen", empty: undefined },
      schema: z.object({ status: z.literal("ok"), environment: z.string() }),
    });

    expect(data.status).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/health?q=ramen`);
    expect(init.credentials).toBe("omit");
    expect(init.headers.Authorization).toMatch(/^Bearer header\./);
  });

  it("sends JSON bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "1" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await api.post("/captures", { content: "hello" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ content: "hello" }));
  });

  it("turns the shared error body into an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "validation_error", message: "Some fields need attention.", request_id: "abc123", details: [{ field: "content", issue: "Field required" }] } },
          { status: 422 },
        ),
      ),
    );
    const error = await api.post("/captures", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "validation_error", requestId: "abc123" });
    expect((error as ApiError).details[0].field).toBe("content");
  });

  it("reads Retry-After on rate limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "rate_limited", message: "Too many requests.", request_id: "r1" } }, { status: 429, headers: { "retry-after": "12" } }),
      ),
    );
    const error = (await api.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("rate_limited");
    expect(error.retryAfter).toBe(12);
  });

  it("handles non-JSON error pages and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })));
    expect(await api.get("/x").catch((e: unknown) => e)).toMatchObject({ code: "internal_error", status: 502 });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = (await api.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("network_error");
    expect(error.isRetryable).toBe(true);
  });

  it("rejects a success body that fails its schema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })));
    const error = await api.get("/health", { schema: z.object({ status: z.string() }) }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "invalid_response" });
  });

  it("retries once with a fresh token after a 401", async () => {
    const unauthorized = jsonResponse({ error: { code: "unauthenticated", message: "Sign in", request_id: "r" } }, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api.get("/me")).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toContain("sig-t1");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toContain("sig-t2");
  });

  it("calls the session-ended handler when the retry also fails", async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    const unauthorized = () => jsonResponse({ error: { code: "unauthenticated", message: "Sign in", request_id: "r" } }, { status: 401 });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => unauthorized()));
    const error = (await api.get("/me").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("unauthenticated");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call the API at all without a session", async () => {
    setTokenFetcher(async () => null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const error = (await api.get("/me").catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("unauthenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends no token to public endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok", environment: "test" }));
    vi.stubGlobal("fetch", fetchMock);
    await api.get("/health", { auth: false });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
