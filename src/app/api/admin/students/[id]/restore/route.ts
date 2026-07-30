import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { SyncService } from "@/services/sync.service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id: studentId } = await params;

    if (!studentId) {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Determine eligibility based on verification and approval statuses
    const isEligible = student.profileStatus === "VERIFIED" && student.adminApprovalStatus === "APPROVED";

    await prisma.studentProfile.update({
      where: { id: studentId },
      data: {
        archivedAt: null,
        archivedById: null,
        leaderboardEligible: isEligible,
        dashboardEligible: isEligible
      }
    });

    // Recalculate leaderboard ranks if they were eligible and returned to leaderboard
    if (isEligible) {
      await SyncService.recalculateLeaderboardRanks();
    }

    // Record audit log
    await recordAuditEvent({
      actorUserId: admin.id,
      action: "STUDENT_RESTORED",
      targetType: "StudentProfile",
      targetId: studentId,
      metadata: { studentId }
    });

    // Clear caches
    try {
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath(`/student/${studentId}`);
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Restore error:", err);
    if (err.name === "AuthError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: err.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
