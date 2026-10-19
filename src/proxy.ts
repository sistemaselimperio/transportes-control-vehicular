import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: redirects unauthenticated requests to /login based on the
 * session cookie only. Real session validation happens in the (app) layout.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  // A cookie may belong to a session that no longer exists, so /login is
  // never redirected here: the login page validates the real session itself.
  if (pathname === "/login") return NextResponse.next();
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
