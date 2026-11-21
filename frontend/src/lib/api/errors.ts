import { z } from "zod";

/** Mirrors backend app/core/errors.py. Branch on `code`; show `message`. */
export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "conflict"
  | "payload_too_large"
  | "unsafe_url"
  | "rate_limited"
  | "provider_error"
  | "provider_not_configured"
  | "internal_error"
  // client-side only
  | "network_error"
  | "timeout"
  | "invalid_response"
  | (string & {});

export interface FieldIssue {
  field: string;
  issue: string;
}

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    request_id: z.string(),
    details: z.array(z.object({ field: z.string(), issue: z.string() })).optional(),
  }),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly requestId?: string;
  readonly details: FieldIssue[];
  /** Seconds to wait, for rate_limited responses. */
  readonly retryAfter?: number;

  constructor(init: {
    status: number;
    code: ApiErrorCode;
    message: string;
    requestId?: string;
    details?: FieldIssue[];
    retryAfter?: number;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.details = init.details ?? [];
    this.retryAfter = init.retryAfter;
  }

  get isUnauthenticated() {
    return this.code === "unauthenticated";
  }

  /** Worth retrying automatically (network blips, timeouts, upstream failures). */
  get isRetryable() {
    return ["network_error", "timeout", "provider_error", "internal_error"].includes(this.code);
  }
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfter = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // not JSON (a proxy error page, for example): fall through to the generic error
  }
  const parsed = errorBodySchema.safeParse(body);
  if (parsed.success) {
    const { code, message, request_id, details } = parsed.data.error;
    return new ApiError({ status: response.status, code, message, requestId: request_id ?? requestId, details, retryAfter });
  }
  return new ApiError({
    status: response.status,
    code: response.status >= 500 ? "internal_error" : "bad_request",
    message: "Something went wrong. Try again in a moment.",
    requestId,
    retryAfter,
  });
}
