import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try to find the profile in database
    let profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    // Fallback: If profile doesn't exist but user exists in Supabase, create it
    if (!profile) {
      const email = user.email || "";
      const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0] || "User";
      
      const lowerEmail = email.toLowerCase();
      const isGK = lowerEmail === "gk@college.edu" || lowerEmail.includes("gksir");
      const role = isGK ? "ADMIN" : (user.user_metadata?.role?.toUpperCase() || "STUDENT");

      profile = await prisma.profile.create({
        data: {
          id: user.id,
          authUserId: user.id,
          email,
          name,
          role,
          department: user.user_metadata?.department || null,
          year: user.user_metadata?.year ? parseInt(user.user_metadata.year) : null,
          avatarUrl: user.user_metadata?.avatar_url || null,
        },
      });
    }

    // Return mapped object for UI backward compatibility
    const uiProfile = {
      ...profile,
      profileImage: profile.avatarUrl,
    };

    return NextResponse.json({ profile: uiProfile });
  } catch (err: any) {
    console.error("Error in GET /api/auth/me:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, department, year, profileImage } = body;

    const updatedProfile = await prisma.profile.update({
      where: { id: user.id },
      data: {
        name,
        department,
        year: year ? parseInt(year) : null,
        avatarUrl: profileImage,
      },
    });

    // Return mapped object for UI backward compatibility
    const uiProfile = {
      ...updatedProfile,
      profileImage: updatedProfile.avatarUrl,
    };

    return NextResponse.json({ success: true, profile: uiProfile });
  } catch (err: any) {
    console.error("Error in PUT /api/auth/me:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
