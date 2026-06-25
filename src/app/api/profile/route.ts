import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validation schema for profile submission
const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Name must be at least 2 characters long"),
  rollNumber: z.string().regex(/^[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{4}$/i, {
    message: "Roll number must match college format (e.g. 23AG1A0501)",
  }),
  department: z.enum(["CSE", "IT", "ECE", "EEE", "ME", "CE", "CSM", "CSD"]),
  year: z.number().int().min(1).max(4),
  codechefUsername: z.string().min(3, "Username must be at least 3 characters").nullable().optional(),
  profilePictureUrl: z.string().url("Must be a valid URL").or(z.literal("")).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    const profile = dbUser.studentProfile
      ? {
          id: dbUser.id,
          name: dbUser.studentProfile.name,
          rollNumber: dbUser.studentProfile.rollNumber,
          department: dbUser.studentProfile.department,
          year: dbUser.studentProfile.year,
          profilePictureUrl: dbUser.studentProfile.profilePictureUrl,
          codechefUsername: dbUser.studentProfile.codechefUsername,
          role: dbUser.role,
        }
      : dbUser.role !== "STUDENT"
      ? {
          id: dbUser.id,
          name: dbUser.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          rollNumber: "STAFF",
          department: "ADMINISTRATION",
          year: 0,
          profilePictureUrl: null,
          codechefUsername: null,
          role: dbUser.role,
        }
      : null;

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error("Error fetching profile API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate caller
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const result = profileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = result.data;

    // Verify ownership or role privilege
    const userRole = user.user_metadata?.role || "STUDENT";
    const isElevated = ["ADMIN", "FACULTY", "PLACEMENT_OFFICER", "PRINCIPAL"].includes(userRole);
    if (data.id !== user.id && !isElevated) {
      return NextResponse.json({ error: "Access denied. Cannot modify other student profiles." }, { status: 403 });
    }

    // Check if roll number is taken by another student
    const existingRoll = await prisma.studentProfile.findFirst({
      where: {
        rollNumber: { equals: data.rollNumber, mode: "insensitive" },
        id: { not: data.id },
      },
    });

    if (existingRoll) {
      return NextResponse.json(
        { error: "Roll number is already registered by another student." },
        { status: 400 }
      );
    }

    // Check if CodeChef username is already linked to another profile
    if (data.codechefUsername) {
      const existingUsername = await prisma.studentProfile.findFirst({
        where: {
          codechefUsername: { equals: data.codechefUsername, mode: "insensitive" },
          id: { not: data.id },
        },
      });

      if (existingUsername) {
        return NextResponse.json(
          { error: "CodeChef username is already linked to another student." },
          { status: 400 }
        );
      }
    }

    // Fetch existing profile to check if CodeChef username changed
    const currentProfile = await prisma.studentProfile.findUnique({
      where: { id: data.id },
    });

    const isUsernameNew =
      data.codechefUsername &&
      (!currentProfile || currentProfile.codechefUsername !== data.codechefUsername);

    // Upsert User (ensure parent record exists) and Student Profile in a transaction
    const profile = await prisma.$transaction(async (tx) => {
      // Ensure user entry exists
      await tx.user.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          email: `${data.rollNumber.toLowerCase()}@ace.edu`, // Mock email fallback or custom logic
          role: "STUDENT",
        },
        update: {},
      });

      return tx.studentProfile.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          name: data.name,
          rollNumber: data.rollNumber,
          department: data.department,
          year: data.year,
          codechefUsername: data.codechefUsername || null,
          profilePictureUrl: data.profilePictureUrl || null,
        },
        update: {
          name: data.name,
          rollNumber: data.rollNumber,
          department: data.department,
          year: data.year,
          codechefUsername: data.codechefUsername || null,
          profilePictureUrl: data.profilePictureUrl || null,
        },
      });
    });

    // If CodeChef username is new/updated, trigger a profile sync asynchronously in the background
    if (isUsernameNew && data.codechefUsername) {
      // Run sync in the background so API returns immediately
      SyncService.syncStudent(data.id, "USER_MANUAL")
        .then((syncRes) => {
          if (!syncRes.success) {
            console.error(`Background initial sync failed: ${syncRes.error}`);
          } else {
            console.log(`Background initial sync succeeded for student ${data.id}`);
          }
        })
        .catch((e) => console.error("Sync error:", e));
    }

    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    console.error("Error updating profile API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
