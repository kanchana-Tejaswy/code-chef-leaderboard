import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/leaderboard",
  "/analytics",
  "/departments",
  "/insights",
  "/student",
  "/settings",
];

// Routes for guests only (redirect to dashboard if logged in)
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Update session & get current user
  let { supabaseResponse, user } = await updateSession(request);

  const isAuthenticated = !!user;

  // 2. Check if trying to access a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // 3. Check if trying to access an admin-only route
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");

  // 4. Check if trying to access guest-only auth routes
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Guest Access checks
  if (isProtectedRoute || isAdminRoute) {
    if (!isAuthenticated) {
      // Redirect to login
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Role-based authorization check
    const userRole = (user.user_metadata?.role || "STUDENT").toUpperCase();

    if (userRole === "STUDENT" && (pathname === "/dashboard" || pathname.startsWith("/admin") || pathname.startsWith("/analytics") || pathname.startsWith("/api/admin"))) {
      const url = request.nextUrl.clone();
      url.pathname = "/student-profile";
      return NextResponse.redirect(url);
    }

    if (isAdminRoute && userRole !== "ADMIN") {
      // Non-admins cannot access admin panels or admin APIs
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Authenticated user checks (cannot visit login/signup pages)
  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    const userRole = (user.user_metadata?.role || "STUDENT").toUpperCase();
    if (userRole === "ADMIN") {
      url.pathname = "/dashboard";
    } else {
      url.pathname = "/student-profile";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
