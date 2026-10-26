import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth Proxy / Route Guard Middleware
 *
 * Enforces role-based access control and session verification:
 * - Unauthenticated requests to private or admin routes redirect to /login
 * - Authenticated requests lacking the "admin" role redirect away from /admin
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const authToken = request.cookies.get("auth-token")?.value;
  const userRole = request.cookies.get("user-role")?.value || "user";

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isPrivateRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/settings");
  const isAdminRoute = pathname.startsWith("/admin");

  // If unauthenticated user tries to access protected areas, redirect to /login
  if ((isPrivateRoute || isAdminRoute) && !authToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user without admin role accesses admin area, forbid or redirect to dashboard
  if (isAdminRoute && userRole !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If already authenticated user visits auth routes, redirect to dashboard
  if (isAuthRoute && authToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
