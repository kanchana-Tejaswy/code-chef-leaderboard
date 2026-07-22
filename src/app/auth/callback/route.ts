import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import { AccountStatus } from "@prisma/client";
import { getRoleHomePath } from "@/lib/auth";
import { EmailOtpType } from "@supabase/supabase-js";

function getSafeRedirectPath(nextParam: string | null, fallback: string): string {
  if (!nextParam) return fallback;
  if (nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")) {
    return nextParam;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = requestUrl.searchParams.get("next");
  const authError = requestUrl.searchParams.get("error");

  const loginUrl = new URL("/login", request.url);

  if (authError) {
    loginUrl.searchParams.set("error", "authentication_failed");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    loginUrl.searchParams.set("error", "invalid_callback");
    return NextResponse.redirect(loginUrl);
  }

  const userAccess = await prisma.userAccess.findUnique({
    where: { authUserId: user.id },
  });

  if (!userAccess) {
    await supabase.auth.signOut();
    loginUrl.searchParams.set("error", "account_not_found");
    return NextResponse.redirect(loginUrl);
  }

  if (userAccess.status === AccountStatus.SUSPENDED || userAccess.status === AccountStatus.DISABLED) {
    await supabase.auth.signOut();
    loginUrl.searchParams.set("error", "account_disabled");
    return NextResponse.redirect(loginUrl);
  }

  if (userAccess.status === AccountStatus.PENDING || userAccess.mustSetPassword) {
    const targetPath = getSafeRedirectPath(nextParam, "/auth/set-password");
    const redirectUrl = new URL(targetPath, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value);
    });
    return redirectResponse;
  }

  if (userAccess.status === AccountStatus.ACTIVE) {
    const defaultHome = getRoleHomePath(userAccess);
    const targetPath = getSafeRedirectPath(nextParam, defaultHome);
    const redirectUrl = new URL(targetPath, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value);
    });
    return redirectResponse;
  }

  await supabase.auth.signOut();
  loginUrl.searchParams.set("error", "invalid_account_status");
  return NextResponse.redirect(loginUrl);
}
