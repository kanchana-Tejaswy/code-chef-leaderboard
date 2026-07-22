import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const studentId = body.studentId;

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId parameter" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const result = await SyncService.syncStudent(studentId, "USER_MANUAL");

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Synchronization failed." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
    }

    // Fetch the updated profiles and AI analysis to return to the UI
    const updatedProfile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile successfully synchronized with CodeChef.",
      profile: updatedProfile,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in manual sync API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}

