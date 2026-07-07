import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

    // Create the response redirect object first
    const response = NextResponse.redirect(`${origin}${next}`);

    // Create Supabase client that writes cookies directly onto the response
    const supabase = createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    console.log(`[Auth Callback] Received OAuth code, exchanging for session...`);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log(`[Auth Callback] Session exchanged successfully!`);
      // Sync Google Auth metadata and pre-create database profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const email = user.email || "";
          const lowerEmail = email.toLowerCase();
          const isGK = lowerEmail === "gk@college.edu" || lowerEmail.includes("gksir");
          const role = isGK ? "ADMIN" : "STUDENT";

          console.log(`[Auth Callback] User Authenticated: ID=${user.id}, Email=${email}, Assigned Role=${role}`);

          // Update Supabase Auth user metadata
          if (user.user_metadata?.role !== role) {
            console.log(`[Auth Callback] Updating user metadata role to: ${role}`);
            await supabase.auth.updateUser({
              data: { role },
            });
          }

          // Create database profile if missing
          const prisma = (await import("@/lib/prisma")).default;
          let profile = await prisma.profile.findUnique({
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
      return response; // Return the response containing the set cookies!
    } else {
      console.error(`[Auth Callback] Exchange session error:`, error.message);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication failed`);
}
