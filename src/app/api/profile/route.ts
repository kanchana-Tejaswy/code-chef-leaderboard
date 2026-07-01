import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { ActivityService } from "@/services/activity.service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("id") || searchParams.get("userId") || searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        codechefProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error("Error fetching profile API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, rollNumber, department, year, codechefUsername, leetcodeUsername, githubUsername, profilePictureUrl } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "id and name are required fields" }, { status: 400 });
    }

    // Check if roll number is taken by another student
    if (rollNumber) {
      const existingRoll = await prisma.studentProfile.findFirst({
        where: {
          rollNumber: { equals: rollNumber },
          id: { not: id },
        },
      });

      if (existingRoll) {
        return NextResponse.json(
          { error: "Roll number is already registered by another student." },
          { status: 400 }
        );
      }
    }

    // Check if CodeChef username is already linked to another profile
    if (codechefUsername) {
      const existingUsername = await prisma.studentProfile.findFirst({
        where: {
          codechefUsername: { equals: codechefUsername },
          id: { not: id },
        },
      });

      if (existingUsername) {
        return NextResponse.json(
          { error: "CodeChef username is already linked to another student." },
          { status: 400 }
        );
      }
    }

    // Check if LeetCode username is already linked to another profile
    if (leetcodeUsername) {
      const existingUsername = await prisma.studentProfile.findFirst({
        where: {
          leetcodeUsername: { equals: leetcodeUsername },
          id: { not: id },
        },
      });

      if (existingUsername) {
        return NextResponse.json(
          { error: "LeetCode username is already linked to another student." },
          { status: 400 }
        );
      }
    }

    // Check if GitHub username is already linked to another profile
    if (githubUsername) {
      const existingUsername = await prisma.studentProfile.findFirst({
        where: {
          githubUsername: { equals: githubUsername },
          id: { not: id },
        },
      });

      if (existingUsername) {
        return NextResponse.json(
          { error: "GitHub username is already linked to another student." },
          { status: 400 }
        );
      }
    }

    // Fetch existing profile to check if usernames changed
    const currentProfile = await prisma.studentProfile.findUnique({
      where: { id },
    });

    const isCodechefNew =
      codechefUsername &&
      (!currentProfile || currentProfile.codechefUsername !== codechefUsername);

    const isLeetcodeNew =
      leetcodeUsername &&
      (!currentProfile || currentProfile.leetcodeUsername !== leetcodeUsername);

    const isGithubNew =
      githubUsername &&
      (!currentProfile || currentProfile.githubUsername !== githubUsername);

    const isUsernameNew = isCodechefNew || isLeetcodeNew || isGithubNew;

    // Update Student Profile directly
    const profile = await prisma.studentProfile.upsert({
      where: { id },
      create: {
        id,
        name,
        rollNumber,
        department,
        year,
        codechefUsername: codechefUsername || null,
        leetcodeUsername: leetcodeUsername || null,
        githubUsername: githubUsername || null,
        profilePictureUrl: profilePictureUrl || null,
      },
      update: {
        name,
        rollNumber,
        department,
        year,
        codechefUsername: codechefUsername || null,
        leetcodeUsername: leetcodeUsername || null,
        githubUsername: githubUsername || null,
        profilePictureUrl: profilePictureUrl || null,
      },
    });

    // If any username is new/updated, trigger a profile sync asynchronously in the background
    if (isUsernameNew) {
      SyncService.syncStudent(id, "USER_MANUAL")
        .then((syncRes) => {
          if (!syncRes.success) {
            console.error(`Background initial sync failed: ${syncRes.error}`);
          } else {
            console.log(`Background initial sync succeeded for student ${id}`);
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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("id") || searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "Missing student id parameter" }, { status: 400 });
    }

    // Fetch student info first to construct message
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (student) {
      // Log Student Delete Event
      await ActivityService.logEvent(
        "STUDENT_DELETE",
        null,
        `${student.name} (${student.department || "CSE"}) profile was removed from standings.`
      );
    }

    // Delete student profile (foreign keys cascade and delete related tables)
    await prisma.studentProfile.delete({
      where: { id: studentId },
    });

    // Recalculate ranks on the leaderboard
    await SyncService.recalculateLeaderboardRanks();

    return NextResponse.json({ success: true, message: "Student deleted successfully." });
  } catch (err: any) {
    console.error("Error in delete profile API:", err);
    return NextResponse.json({ error: err.message || "Failed to delete student profile." }, { status: 500 });
  }
}
