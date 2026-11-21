import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client", () => ({ authClient: {} }));

import { safeNext } from "./auth-form";

describe("safeNext", () => {
  it.each([
    ["/app/settings", "/app/settings"],
    ["/app?x=1", "/app?x=1"],
    [null, "/app"],
    ["https://evil.example", "/app"],
    ["//evil.example", "/app"],
    ["/\\evil.example", "/app"],
    ["javascript:alert(1)", "/app"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
