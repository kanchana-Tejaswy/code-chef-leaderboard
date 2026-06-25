import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the caller
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json().catch(() => ({}));
    const studentId = body.studentId || user.id;

    // Check caller's role (bypasses rate limit if admin/faculty/placement_officer)
    const userRole = user.user_metadata?.role || "STUDENT";
    const isElevated = ["ADMIN", "FACULTY", "PLACEMENT_OFFICER"].includes(userRole);

    // If a student tries to sync another student's profile, block them
    if (studentId !== user.id && !isElevated) {
      return NextResponse.json({ error: "Access denied. Cannot sync other student profiles." }, { status: 403 });
    }

    // 3. Rate limiting check (Students only)
    if (!isElevated) {
      // General throttle: block any sync attempt (SUCCESS or FAILURE) within the last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const anyRecentSync = await prisma.syncLog.findFirst({
        where: {
          studentId,
          createdAt: { gte: twoMinutesAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      if (anyRecentSync) {
        const nextAllowedTime = new Date(anyRecentSync.createdAt.getTime() + 2 * 60 * 1000);
        const secondsLeft = Math.ceil((nextAllowedTime.getTime() - Date.now()) / 1000);
        return NextResponse.json(
          {
            error: `Rate limit: Please wait ${secondsLeft} seconds before trying again.`,
            nextAllowedTime: nextAllowedTime.toISOString(),
          },
          { status: 429 }
        );
      }

      // 6-hour rate limit: limit successful manual syncs
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const recentSuccess = await prisma.syncLog.findFirst({
        where: {
          studentId,
          status: "SUCCESS",
          createdAt: { gte: sixHoursAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentSuccess) {
        const nextAllowedTime = new Date(recentSuccess.createdAt.getTime() + 6 * 60 * 60 * 1000);
        const minutesLeft = Math.ceil((nextAllowedTime.getTime() - Date.now()) / (60 * 1000));
        return NextResponse.json(
          {
            error: `Rate limit exceeded. You can manually sync again in ${minutesLeft} minutes.`,
            nextAllowedTime: nextAllowedTime.toISOString(),
          },
          { status: 429 }
        );
      }
    }

    // 4. Trigger Sync
    const triggerType = isElevated && studentId !== user.id ? "ADMIN_FORCE" : "USER_MANUAL";
    const result = await SyncService.syncStudent(studentId, triggerType);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Synchronization failed." }, { status: 500 });
    }

    // Fetch the updated CodeChef profile and AI analysis to return to the UI
    const updatedProfile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        codechefProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile successfully synchronized with CodeChef.",
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error("Error in manual sync API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
