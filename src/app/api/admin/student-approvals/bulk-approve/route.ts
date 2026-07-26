import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { SyncService } from "@/services/sync.service";
import { OverallScoreService } from "@/services/overallScore.service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const adminId = admin.id;

    // Find all verified students who are not yet approved
    const eligibleStudents = await prisma.studentProfile.findMany({
      where: {
        profileStatus: "VERIFIED",
        adminApprovalStatus: { not: "APPROVED" },
        codechefProfile: { isNot: null },
        leetcodeProfile: { isNot: null }
      },
      include: {
        codechefProfile: true,
        leetcodeProfile: true
      }
    });

    const totalEligible = eligibleStudents.length;

    if (totalEligible === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No students are eligible for bulk approval."
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const batchSize = 50;
    const approvedStudentIds: string[] = [];

    for (let i = 0; i < totalEligible; i += batchSize) {
      const chunk = eligibleStudents.slice(i, i + batchSize);
      
      await prisma.$transaction(async (tx) => {
        for (const student of chunk) {
          // Update profile fields
          await tx.studentProfile.update({
            where: { id: student.id },
            data: {
              adminApprovalStatus: "APPROVED",
              approvedAt: new Date(),
              approvedById: adminId,
              leaderboardEligible: true,
              dashboardEligible: true
            }
          });

          // Calculate score metrics and upsert entry
          const ccScore = OverallScoreService.calculateCodechefScore(student.codechefProfile!);
          const lcScore = OverallScoreService.calculateLeetcodeScore(student.leetcodeProfile!);
          const active = { codechef: true, leetcode: true };
          const overallScore = OverallScoreService.calculate({ codechef: ccScore, leetcode: lcScore }, active);

          await tx.leaderboardEntry.upsert({
            where: { studentId: student.id },
            create: {
              studentId: student.id,
              rating: student.codechefProfile!.currentRating || 0,
              stars: student.codechefProfile!.stars ?? 0,
              overallScore,
              codechefScore: ccScore,
              leetcodeScore: lcScore,
              trendDirection: "NEUTRAL",
              rank: 0
            },
            update: {
              rating: student.codechefProfile!.currentRating || 0,
              stars: student.codechefProfile!.stars ?? 0,
              overallScore,
              codechefScore: ccScore,
              leetcodeScore: lcScore
            }
          });

          approvedStudentIds.push(student.id);
        }
      });
    }

    // Recalculate leaderboard ranks globally
    await SyncService.recalculateLeaderboardRanks();

    // Log the bulk approval event
    await recordAuditEvent({
      actorUserId: adminId,
      action: "STUDENTS_BULK_APPROVED",
      targetType: "StudentProfile",
      metadata: {
        count: totalEligible,
        studentIds: approvedStudentIds
      }
    });

    // Clear caches
    try {
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath("/analytics");
      revalidatePath("/departments");
      revalidatePath("/insights");
      revalidatePath("/api/dashboard/stats");
      revalidatePath("/api/leaderboard");
    } catch (e) {
      // Ignored in test environments
    }

    return NextResponse.json({
      success: true,
      count: totalEligible,
      message: `Successfully approved ${totalEligible} students.`
    }, { headers: { "Cache-Control": "private, no-store" } });

  } catch (err: any) {
    console.error("Error bulk approving students:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
