/**
 * The one way the web app talks to the FastAPI backend.
 *
 * - Base URL from NEXT_PUBLIC_API_URL; every path is relative to /api/v1.
 * - Authenticates with a short-lived bearer token from Better Auth (src/lib/api/token.ts); no cookies
 *   go to the API, so a cross-site page cannot make authenticated calls (no CSRF surface).
 * - On a 401 it fetches a fresh token and retries once; if that fails too, the session has ended and
 *   the registered handler sends the user to sign in again.
 * - Parses the API's shared error body into an ApiError with a stable `code`.
 * - Optionally validates the success body with a Zod schema, so the UI never trusts unchecked data.
 * - Times out instead of hanging (15 s default).
 */
import type { z } from "zod";

import { publicEnv } from "@/lib/env";

import { ApiError, errorFromResponse } from "./errors";
import { clearApiToken, getApiToken } from "./token";

let onUnauthenticated: (() => void) | null = null;

/** Called once when a request fails with 401 after a token refresh (the session ended). */
export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

export const API_BASE = `${publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/api/v1`;

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions<T> {
  method?: Method;
  /** JSON body; serialised for you. */
  body?: unknown;
  /** Query parameters; undefined and null values are skipped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Validates the success body. Strongly recommended for every call. */
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Send the bearer token (default true). Public endpoints such as /health pass false. */
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions<unknown>["query"]): string {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = "GET", body, query, schema, signal, timeoutMs = 15_000, headers, auth = true } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const send = async (): Promise<Response> => {
    const token = auth ? await getApiToken() : null;
    if (auth && !token) {
      throw new ApiError({ status: 401, code: "unauthenticated", message: "Sign in to continue." });
    }
    return fetch(buildUrl(path, query), {
      method,
      credentials: "omit",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combined,
    });
  };

  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && auth) {
      clearApiToken(); // the token may have expired or the keys rotated: try once with a fresh one
      response = await send();
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isUnauthenticated) onUnauthenticated?.();
      throw error;
    }
    if (signal?.aborted) throw error; // the caller cancelled: let React Query handle it
    const timedOut = timeout.aborted;
    throw new ApiError({
      status: 0,
      code: timedOut ? "timeout" : "network_error",
      message: timedOut ? "The server took too long to answer. Try again." : "Could not reach the server. Check your connection.",
    });
  }

  if (!response.ok) {
    const error = await errorFromResponse(response);
    if (error.isUnauthenticated && auth) {
      clearApiToken();
      onUnauthenticated?.();
    }
    throw error;
  }
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json();
  if (!schema) return data as T;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      status: response.status,
      code: "invalid_response",
      message: "The server sent something unexpected. Try again.",
      requestId: response.headers.get("x-request-id") ?? undefined,
    });
  }
  return parsed.data;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions<T>, "method" | "body">) => apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
