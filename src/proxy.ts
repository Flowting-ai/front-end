import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ROUTES = "/auth/";
const PUBLIC_ROUTES = [AUTH_ROUTES, "/api/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let auth and API routes pass through
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Protect all other routes — redirect to login if no session
  const hasSession = request.cookies.getAll().some(
    (c) => c.name.startsWith("__session") || c.name.startsWith("appSession")
  );

  if (!hasSession) {
const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
