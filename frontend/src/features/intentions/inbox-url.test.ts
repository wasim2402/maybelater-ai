import { describe, expect, it } from "vitest";

import { sinceToDate, toQuery } from "./api";
import { hasRefinements, readFilters, writeFilters } from "./inbox-url";

describe("inbox filters in the URL", () => {
  it("round-trips every filter", () => {
    const filters = { status: "completed" as const, q: "sourdough", category: "none", tag: "baking", since: "30d" as const };
    const url = writeFilters(filters);
    expect(url).toBe("/app?status=completed&q=sourdough&category=none&tag=baking&since=30d");
    expect(readFilters(new URL(url, "http://x").searchParams)).toEqual(filters);
  });

  it("defaults to open items with nothing else and ignores unknown values", () => {
    expect(writeFilters({ status: "open", q: "   " })).toBe("/app");
    expect(readFilters(new URLSearchParams("status=deleted&since=forever"))).toEqual({
      status: "open",
      q: undefined,
      category: undefined,
      tag: undefined,
      since: undefined,
    });
  });

  it("knows when the view is refined", () => {
    expect(hasRefinements({ status: "archived" })).toBe(false);
    expect(hasRefinements({ status: "open", tag: "x" })).toBe(true);
  });
});

describe("query building", () => {
  it("sends only what is set, with an offset date for 'since'", () => {
    const query = toQuery({ status: "open", q: " ramen ", since: "7d" });
    expect(query.q).toBe("ramen");
    expect(query.category).toBeUndefined();
    expect(query.created_after).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00[+-]\d{2}:\d{2}$/);
  });

  it("computes windows from local midnight", () => {
    const now = new Date(2026, 10, 21, 15, 30); // 21 Nov 2026, local time
    expect(sinceToDate("7d", now)).toMatch(/^2026-11-14T00:00:00/);
    expect(sinceToDate("30d", now)).toMatch(/^2026-10-22T00:00:00/);
    expect(sinceToDate("year", now)).toMatch(/^2026-01-01T00:00:00/);
    expect(sinceToDate(undefined, now)).toBeUndefined();
  });
});
