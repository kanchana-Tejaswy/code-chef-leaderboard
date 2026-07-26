import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { SyncService } from "@/services/sync.service";
import { OverallScoreService } from "@/services/overallScore.service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const adminId = admin.id;

    const { id: studentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, note = "" } = body;

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { codechefProfile: true, leetcodeProfile: true }
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }

    if (action === "sync") {
      // Direct student verification sync
      const result = await SyncService.syncStudent(studentId, "ADMIN_FORCE", false);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Synchronization failed." }, { status: 500 });
      }
      
      const updated = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { codechefProfile: true, leetcodeProfile: true, leaderboardEntry: true }
      });
      return NextResponse.json({ success: true, student: updated }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (action === "approve") {
      // Verification check: both platforms must be verified
      if (!student.codechefProfile || !student.leetcodeProfile) {
        return NextResponse.json(
          { error: "Both CodeChef and LeetCode profiles must be verified before approval." },
          { status: 400 }
        );
      }

      // Update StudentProfile approval fields
      const updatedStudent = await prisma.studentProfile.update({
        where: { id: studentId },
        data: {
          adminApprovalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedById: adminId,
          approvalNote: note || null,
          leaderboardEligible: true,
          dashboardEligible: true,
          profileStatus: "VERIFIED"
        }
      });

      // Calculate initial competitive scores and upsert LeaderboardEntry
      const ccScore = OverallScoreService.calculateCodechefScore(student.codechefProfile);
      const lcScore = OverallScoreService.calculateLeetcodeScore(student.leetcodeProfile);
      const active = { codechef: true, leetcode: true };
      const overallScore = OverallScoreService.calculate({ codechef: ccScore, leetcode: lcScore }, active);

      await prisma.leaderboardEntry.upsert({
        where: { studentId },
        create: {
          studentId,
          rating: student.codechefProfile.currentRating || 0,
          stars: student.codechefProfile.stars ?? 0,
          overallScore,
          codechefScore: ccScore,
          leetcodeScore: lcScore,
          trendDirection: "NEUTRAL",
          rank: 0
        },
        update: {
          rating: student.codechefProfile.currentRating || 0,
          stars: student.codechefProfile.stars ?? 0,
          overallScore,
          codechefScore: ccScore,
          leetcodeScore: lcScore
        }
      });

      // Recalculate dense ranks
      await SyncService.recalculateLeaderboardRanks();

      // Record audit log
      await recordAuditEvent({
        actorUserId: adminId,
        action: "STUDENT_APPROVED",
        targetType: "StudentProfile",
        targetId: studentId,
        metadata: { note }
      });

      // Clear caches
      revalidateCaches();

      return NextResponse.json({ success: true, student: updatedStudent }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (action === "reject") {
      const updatedStudent = await prisma.studentProfile.update({
        where: { id: studentId },
        data: {
          adminApprovalStatus: "REJECTED",
          leaderboardEligible: false,
          dashboardEligible: false,
          approvalNote: note || null
        }
      });

      // Record audit log
      await recordAuditEvent({
        actorUserId: adminId,
        action: "STUDENT_REJECTED",
        targetType: "StudentProfile",
        targetId: studentId,
        metadata: { note }
      });

      // Clear caches
      revalidateCaches();

      return NextResponse.json({ success: true, student: updatedStudent }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (action === "revoke") {
      const updatedStudent = await prisma.studentProfile.update({
        where: { id: studentId },
        data: {
          adminApprovalStatus: "REVOKED",
          leaderboardEligible: false,
          dashboardEligible: false,
          approvalNote: note || null
        }
      });

      // Remove from ranked results by deleting leaderboard entry
      await prisma.leaderboardEntry.deleteMany({
        where: { studentId }
      });

      // Recalculate dense ranks
      await SyncService.recalculateLeaderboardRanks();

      // Record audit log
      await recordAuditEvent({
        actorUserId: adminId,
        action: "STUDENT_APPROVAL_REVOKED",
        targetType: "StudentProfile",
        targetId: studentId,
        metadata: { note }
      });

      // Clear caches
      revalidateCaches();

      return NextResponse.json({ success: true, student: updatedStudent }, { headers: { "Cache-Control": "private, no-store" } });
    }

    return NextResponse.json({ error: "Invalid action parameter." }, { status: 400 });

  } catch (err: any) {
    console.error("Error processing student approval edit PATCH:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function revalidateCaches() {
  try {
    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
    revalidatePath("/analytics");
    revalidatePath("/departments");
    revalidatePath("/insights");
    revalidatePath("/api/dashboard/stats");
    revalidatePath("/api/leaderboard");
  } catch (e) {
    // Ignored in test environment
  }
}
