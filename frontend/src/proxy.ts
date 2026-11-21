import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirects only: checks that a session cookie exists, not that it is valid.
 * Real checks happen on the server (the protected layout) and in FastAPI (every request).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (pathname.startsWith("/app") && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  if ((pathname === "/login" || pathname === "/signup") && hasSession) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
