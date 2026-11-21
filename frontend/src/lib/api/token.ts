/**
 * Short-lived API tokens (JWT, 15 min) for calling FastAPI, minted by Better Auth from the session
 * cookie (GET /api/auth/token). Kept in memory only, never in localStorage, and refreshed a minute
 * before expiry. Concurrent callers share one in-flight request.
 */

type TokenFetcher = () => Promise<string | null>;

let fetcher: TokenFetcher = async () => {
  const response = await fetch("/api/auth/token", { credentials: "include", headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const body = (await response.json()) as { token?: unknown };
  return typeof body.token === "string" ? body.token : null;
};

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

const REFRESH_MARGIN_MS = 60_000;

function expiryOf(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** A valid API token, or null when there is no session. */
export async function getApiToken(): Promise<string | null> {
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.token;
  inflight ??= fetcher()
    .then((token) => {
      cached = token ? { token, expiresAt: expiryOf(token) } : null;
      return token;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Drops the cached token (after a 401, on sign-out or account deletion). */
export function clearApiToken(): void {
  cached = null;
}

/** Test hook. */
export function setTokenFetcher(next: TokenFetcher): void {
  fetcher = next;
  cached = null;
  inflight = null;
}
