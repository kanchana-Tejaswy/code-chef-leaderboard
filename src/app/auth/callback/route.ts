import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  console.log(`\n--- [Auth Callback Start] ---`);
  console.log(`[Auth Callback] Route reached. Request URL: ${request.url}`);
  console.log(`[Auth Callback] OAuth Code received: ${code ? "Yes" : "No"}`);
  console.log(`[Auth Callback] Target next redirect path: ${next}`);

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error("[Auth Callback] Missing credentials! NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined.");
      return NextResponse.redirect(`${origin}/login?error=Supabase credentials missing`);
    }

    // Create the redirect response object first
    const response = NextResponse.redirect(`${origin}${next}`);

    console.log(`[Auth Callback] Initializing inline Supabase client...`);
    const supabase = createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    console.log(`[Auth Callback] Exchanging OAuth code for session...`);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log(`[Auth Callback] Session exchanged successfully!`);
      const { data: { session } } = await supabase.auth.getSession();
      console.log(`[Auth Callback] Session status: ${session ? "Active" : "None"}`);
      if (session) {
        console.log(`[Auth Callback] Access Token Present: ${!!session.access_token}`);
        console.log(`[Auth Callback] Expires At: ${session.expires_at}`);
      }

      // Sync Google Auth metadata and pre-create database profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const email = user.email || "";
          const lowerEmail = email.toLowerCase();
          const isGK = lowerEmail === "gk@college.edu" || lowerEmail.includes("gksir") || lowerEmail === "demo-admin@college.edu" || lowerEmail === "demo@college.edu";
          const role = isGK ? "ADMIN" : "STUDENT";

          console.log(`[Auth Callback] Authenticated User details:`);
          console.log(`  - User ID: ${user.id}`);
          console.log(`  - Email: ${email}`);
          console.log(`  - Raw Metadata Role: ${user.user_metadata?.role || "none"}`);
          console.log(`  - Assigned System Role: ${role}`);

          // Update Supabase Auth user metadata bypassed to prevent webhook timeouts
          console.log(`[Auth Callback] Role assignment set dynamically. Server updateUser call bypassed.`);

          // Create database profile if missing
          const prisma = (await import("@/lib/prisma")).default;
          const profile = await prisma.profile.findUnique({
            where: { id: user.id },
          });

          if (!profile) {
            console.log(`[Auth Callback] Creating new database profile for ID=${user.id}`);
            const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0] || "User";
            await prisma.profile.create({
              data: {
                id: user.id,
                authUserId: user.id,
                email,
                name,
                role,
                avatarUrl: user.user_metadata?.avatar_url || null,
              },
            });
          } else {
            console.log(`[Auth Callback] Found existing database profile for ID=${user.id}, Role=${profile.role}`);
          }
        }
      } catch (syncErr) {
        console.error("Error syncing auth callback metadata/profile:", syncErr);
      }

      console.log(`[Auth Callback] Redirecting to: ${next}`);
      console.log(`--- [Auth Callback End] ---\n`);
      return response;
    } else {
      console.error(`[Auth Callback] Exchange session error:`, error.message);
      console.log(`--- [Auth Callback End] ---\n`);
    }
  }

  console.log(`[Auth Callback] Authentication failed or code missing. Redirecting to /login`);
  console.log(`--- [Auth Callback End] ---\n`);
  return NextResponse.redirect(`${origin}/login?error=Authentication failed`);
}
