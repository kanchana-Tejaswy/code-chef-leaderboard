import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { SyncService } from "@/services/sync.service";
import { prisma } from "@/lib/prisma";

function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  
  if (!adminSecret) return false;
  
  if (authHeader && authHeader.trim().toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token === adminSecret) return true;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    let authorized = false;
    try {
      await requireAdmin();
      authorized = true;
    } catch (e) {
      if (isAdmin(request)) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const studentId = body.studentProfileId; // Explicitly use studentProfileId as requested

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentProfileId parameter" }, { status: 400 });
    }

    const result = await SyncService.syncStudent(studentId, "ADMIN_FORCE", false);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Synchronization failed." }, { status: 500 });
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
      message: "Profile successfully synchronized.",
      profile: updatedProfile,
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in per-student admin refresh API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
