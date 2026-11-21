import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { API_BASE, api } from "./client";
import { ApiError } from "./errors";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", ...init.headers }, status: init.status ?? 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("calls /api/v1 with credentials and query params, and validates the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok", environment: "development" }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await api.get("/health", {
      query: { q: "ramen", empty: undefined },
      schema: z.object({ status: z.literal("ok"), environment: z.string() }),
    });

    expect(data.status).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/health?q=ramen`);
    expect(init.credentials).toBe("include");
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
});
