import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard"];

// Get session token from cookies (HTTPS uses __Secure- prefix)
function getSessionToken(request: NextRequest) {
  return (
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const sessionToken = getSessionToken(request);

  if (isProtectedRoute && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
