/**
 * Better Auth configuration, shared by the Next.js route handler (server.ts) and the table
 * migration script (scripts/migrate-auth.ts). Relative imports only, so the script can load it.
 *
 * How the two apps share a session (see docs/AUTH.md):
 *   - The browser signs in here; Better Auth keeps an HTTP-only session cookie on the web origin.
 *   - For API calls the browser asks GET /api/auth/token for a short-lived JWT (EdDSA, 15 min),
 *     signed with keys only this server holds, and sends it as `Authorization: Bearer`.
 *   - FastAPI verifies the JWT with the public keys from GET /api/auth/jwks. No secret is shared.
 */
import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { Pool } from "pg";

/** Better Auth's tables live in their own PostgreSQL schema, apart from the app's (public, Alembic). */
export const AUTH_SCHEMA = "auth";
export const API_AUDIENCE = "maybelater-api";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy it from .env.example into frontend/.env.local.`);
  return value;
}

/**
 * Runs inside Better Auth's delete-user flow, after the password is verified and before the auth
 * account is removed: deletes the user's data in the API first. If that fails, the whole deletion
 * stops, so a person is never left with a deleted login but data still stored.
 */
async function deleteAppData(request: Request | undefined): Promise<void> {
  if (!request) throw new APIError("BAD_REQUEST", { message: "Account deletion needs a signed-in request." });
  const { auth } = await import("./server");
  const { token } = await auth.api.getToken({ headers: request.headers });
  const apiUrl = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/api/v1/me`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new APIError("INTERNAL_SERVER_ERROR", { message: "Your data could not be deleted right now. Nothing was removed; try again." });
  }
}

export function authOptions() {
  const baseURL = required("BETTER_AUTH_URL");
  const production = process.env.NODE_ENV === "production";

  return {
    appName: "MaybeLater",
    baseURL,
    secret: required("BETTER_AUTH_SECRET"),
    trustedOrigins: [baseURL],
    database: new Pool({
      connectionString: required("AUTH_DATABASE_URL"),
      options: `-c search_path=${AUTH_SCHEMA}`,
      max: 5,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refreshed at most daily
      freshAge: 60 * 15, // sensitive actions (account deletion) need a recent sign-in or the password
    },
    user: {
      deleteUser: { enabled: true, beforeDelete: (_user, request) => deleteAppData(request) },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/request-password-reset": { window: 60 * 10, max: 3 },
        "/delete-user": { window: 60 * 10, max: 5 },
      },
    },
    advanced: {
      // HTTP-only, SameSite=Lax cookies; Secure whenever the site runs on https (always in production).
      useSecureCookies: production,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: production },
    },
    telemetry: { enabled: false },
    plugins: [
      jwt({
        jwt: {
          issuer: baseURL,
          audience: API_AUDIENCE,
          expirationTime: "15m",
          // Only what the API needs to create its user row; nothing else rides in the token.
          definePayload: ({ user }) => ({ email: user.email, name: user.name }),
        },
      }),
      nextCookies(), // must stay last: lets server actions set the session cookie
    ],
  } satisfies BetterAuthOptions;
}
