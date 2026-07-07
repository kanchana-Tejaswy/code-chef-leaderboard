import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Sync Google Auth metadata and pre-create database profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const email = user.email || "";
          const lowerEmail = email.toLowerCase();
          const isGK = lowerEmail === "gk@college.edu" || lowerEmail.includes("gksir");
          const role = isGK ? "ADMIN" : "STUDENT";

          // Update Supabase Auth user metadata
          if (user.user_metadata?.role !== role) {
            await supabase.auth.updateUser({
              data: { role },
            });
          }

          // Create database profile if missing
          let profile = await prisma.profile.findUnique({
            where: { id: user.id },
          });

          if (!profile) {
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
          }
        }
      } catch (syncErr) {
        console.error("Error syncing auth callback metadata/profile:", syncErr);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication failed`);
}
