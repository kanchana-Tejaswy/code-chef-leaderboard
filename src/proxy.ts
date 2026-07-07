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
  const code = request.nextUrl.searchParams.get("code");

  console.log(`\n--- [Proxy/Middleware Start] ---`);
  console.log(`[Proxy] Incoming request for: ${pathname}`);

  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

  // Safety net: If OAuth callback code lands on homepage, redirect to /auth/callback
  if (code && (pathname === "/" || pathname === "")) {
    console.log(`[Proxy] Detected OAuth code on homepage. Redirecting to /auth/callback with code`);
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Bypass redirect if auth is disabled
  if (disableAuth && (pathname === "/" || pathname === "/login" || pathname === "")) {
    console.log(`[Proxy] Auth bypass active. Redirecting from ${pathname} to /admin/dashboard`);


    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  // 1. Update session & get current user
  const isDemoMode = disableAuth || request.cookies.get("demo_mode")?.value === "true";
  let { supabaseResponse, user } = await updateSession(request);

  if (isDemoMode) {
    user = {
      id: "00000000-0000-0000-0000-000000000000",
      email: "demo@college.edu",
      user_metadata: {
        role: "ADMIN",
        full_name: "Demo Admin",
      },
    } as any;
  }

  const isAuthenticated = isDemoMode || !!user;
  const userRole = (user?.user_metadata?.role || "STUDENT").toUpperCase();

  console.log(`[Proxy] Auth Status:`);
  console.log(`  - Authenticated: ${isAuthenticated}`);
  console.log(`  - User ID: ${user?.id || "none"}`);
  console.log(`  - Email: ${user?.email || "none"}`);
  console.log(`  - Metadata Role: ${userRole}`);
  console.log(`  - Cookies Count: ${request.cookies.getAll().length}`);

  // Helper to redirect while preserving Supabase session cookies
  const redirectWithSession = (targetPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    console.log(`[Proxy] Redirecting to: ${targetPath}`);
    const redirectResponse = NextResponse.redirect(url);
    // Copy all cookies from the supabaseResponse to the new redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
      });
    });
    if (isDemoMode) {
      redirectResponse.cookies.set("demo_mode", "true", { path: "/" });
    }
    return redirectResponse;
  };

  // 2. Check route categories
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  console.log(`[Proxy] Route classification:`);
  console.log(`  - isProtectedRoute: ${isProtectedRoute}`);
  console.log(`  - isAdminRoute: ${isAdminRoute}`);
  console.log(`  - isAuthRoute: ${isAuthRoute}`);

  // Guest Access checks
  if (isProtectedRoute || isAdminRoute) {
    if (!isAuthenticated) {
      console.log(`[Proxy] Unauthorized access attempt to protected route: ${pathname}. Redirecting to /login`);
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          path: cookie.path,
          domain: cookie.domain,
          maxAge: cookie.maxAge,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
        });
      });
      return redirectResponse;
    }

    // Role-based authorization check
    if (userRole === "STUDENT" && (pathname === "/dashboard" || pathname.startsWith("/admin") || pathname.startsWith("/analytics") || pathname.startsWith("/api/admin"))) {
      console.log(`[Proxy] Student attempted to access Admin route: ${pathname}. Redirecting to /student-profile`);
      return redirectWithSession("/student-profile");
    }

    if (isAdminRoute && userRole !== "ADMIN") {
      console.log(`[Proxy] Non-admin attempted to access admin route: ${pathname}. Redirecting to /dashboard`);
      return redirectWithSession("/dashboard");
    }
  }

  // Authenticated user checks (cannot visit login/signup pages)
  if (isAuthRoute && isAuthenticated) {
    console.log(`[Proxy] Authenticated user attempted to access guest-only auth route: ${pathname}`);
    if (userRole === "ADMIN") {
      return redirectWithSession("/dashboard");
    } else {
      return redirectWithSession("/student-profile");
    }
  }

  console.log(`[Proxy] Proceeding to next destination: ${pathname}`);
  console.log(`--- [Proxy/Middleware End] ---\n`);
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
