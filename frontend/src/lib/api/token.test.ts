import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearApiToken, getApiToken, setTokenFetcher } from "./token";

function token(secondsLeft: number, tag: string) {
  return `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsLeft }))}.${tag}`;
}

describe("api token cache", () => {
  let fetcher: ReturnType<typeof vi.fn<() => Promise<string | null>>>;
  beforeEach(() => {
    fetcher = vi.fn<() => Promise<string | null>>();
    setTokenFetcher(fetcher);
  });

  it("reuses a token until a minute before it expires", async () => {
    fetcher.mockResolvedValueOnce(token(900, "a")).mockResolvedValueOnce(token(900, "b"));
    expect(await getApiToken()).toContain(".a");
    expect(await getApiToken()).toContain(".a");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes a token that is about to expire", async () => {
    fetcher.mockResolvedValueOnce(token(30, "old")).mockResolvedValueOnce(token(900, "new"));
    await getApiToken();
    expect(await getApiToken()).toContain(".new");
  });

  it("shares one request between concurrent callers", async () => {
    fetcher.mockResolvedValue(token(900, "x"));
    await Promise.all([getApiToken(), getApiToken(), getApiToken()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("forgets the token when cleared and returns null without a session", async () => {
    fetcher.mockResolvedValueOnce(token(900, "a")).mockResolvedValueOnce(null);
    await getApiToken();
    clearApiToken();
    expect(await getApiToken()).toBeNull();
  });
});
