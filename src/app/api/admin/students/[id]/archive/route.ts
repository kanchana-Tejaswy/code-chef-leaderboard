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

    await prisma.$transaction([
      prisma.studentProfile.update({
        where: { id: studentId },
        data: {
          archivedAt: new Date(),
          archivedById: admin.id,
          leaderboardEligible: false,
          dashboardEligible: false
        }
      }),
      prisma.syncJob.deleteMany({
        where: { studentId, status: "QUEUED" }
      })
    ]);

    // Recalculate leaderboard ranks because removing a student changes ranks
    await SyncService.recalculateLeaderboardRanks();

    // Record audit log
    await recordAuditEvent({
      actorUserId: admin.id,
      action: "STUDENT_ARCHIVED",
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
    console.error("Archive error:", err);
    if (err.name === "AuthError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: err.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
