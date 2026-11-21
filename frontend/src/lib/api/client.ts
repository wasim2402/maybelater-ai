/**
 * The one way the web app talks to the FastAPI backend.
 *
 * - Base URL from NEXT_PUBLIC_API_URL; every path is relative to /api/v1.
 * - Sends cookies (credentials: "include") so the API can verify the session (stage 05).
 * - Parses the API's shared error body into an ApiError with a stable `code`.
 * - Optionally validates the success body with a Zod schema, so the UI never trusts unchecked data.
 * - Times out instead of hanging (15 s default).
 */
import type { z } from "zod";

import { publicEnv } from "@/lib/env";

import { ApiError, errorFromResponse } from "./errors";

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
  headers?: HeadersInit;
}

function buildUrl(path: string, query?: RequestOptions<unknown>["query"]): string {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = "GET", body, query, schema, signal, timeoutMs = 15_000, headers } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combined,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // the caller cancelled: let React Query handle it
    const timedOut = timeout.aborted;
    throw new ApiError({
      status: 0,
      code: timedOut ? "timeout" : "network_error",
      message: timedOut ? "The server took too long to answer. Try again." : "Could not reach the server. Check your connection.",
    });
  }

  if (!response.ok) throw await errorFromResponse(response);
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
