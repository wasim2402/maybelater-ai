import "server-only";

import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authOptions } from "./options";

export const auth = betterAuth(authOptions());

export type SessionUser = { id: string; email: string; name: string };

/** The signed-in user for a server component, or null. Reads the request: call it inside <Suspense>. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

/** The signed-in user, or a redirect to the login page. */
export async function requireSessionUser(next = "/app"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
