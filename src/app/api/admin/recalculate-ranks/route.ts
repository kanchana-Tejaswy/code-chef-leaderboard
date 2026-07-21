import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { SyncService } from "@/services/sync.service";
import { OverallScoreService } from "@/services/overallScore.service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const authHeader = request.headers.get("authorization");
    
    // Note: Use a stronger secret pattern in production (e.g., from process.env)
    const ADMIN_SECRET = process.env.ADMIN_API_SECRET || "ADMIN_FORCE";
    if (!authHeader || !authHeader.includes(ADMIN_SECRET)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Admin API] Triggering full score and rank backfill...");

    // 1. Recalculate scores for all leaderboard entries based on platform profile data
    const entries = await prisma.leaderboardEntry.findMany({
      include: {
        student: {
          include: {
            codechefProfile: true,
            leetcodeProfile: true
          }
        }
      }
    });

    let updatedCount = 0;
    for (const entry of entries) {
      const student = entry.student;
      
      const ccScore = student.codechefProfile 
        ? OverallScoreService.calculateCodechefScore(student.codechefProfile) 
        : 0;
      
      const lcScore = student.leetcodeProfile 
        ? OverallScoreService.calculateLeetcodeScore(student.leetcodeProfile) 
        : 0;

      const active = {
        codechef: !!student.codechefProfile,
        leetcode: !!student.leetcodeProfile,
      };

      const overallScore = OverallScoreService.calculate(
        { codechef: ccScore, leetcode: lcScore },
        active
      );

      if (
        entry.overallScore !== overallScore || 
        entry.codechefScore !== ccScore || 
        entry.leetcodeScore !== lcScore
      ) {
        await prisma.leaderboardEntry.update({
          where: { id: entry.id },
          data: {
            overallScore,
            codechefScore: ccScore,
            leetcodeScore: lcScore,
          }
        });
        updatedCount++;
      }
    }
    
    console.log(`[Admin API] Updated scores for ${updatedCount} students.`);

    // 2. Recalculate standard competitive ranks
    console.log("[Admin API] Triggering recalculateLeaderboardRanks manually...");
    await SyncService.recalculateLeaderboardRanks();
    
    // 3. Invalidate caches globally
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath("/analytics");
      revalidatePath("/departments");
      revalidatePath("/insights");
      revalidatePath("/api/dashboard/stats");
      revalidatePath("/api/dashboard/leaderboard-cache");
      revalidatePath("/api/leaderboard");
    } catch (cacheErr) {
      console.error("[Admin API] Cache invalidation failed:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      updatedScores: updatedCount,
      message: "Leaderboard scores and ranks recalculated successfully based on competitive ordering."
    });
  } catch (error: any) {
    console.error("[Admin API] Failed to recalculate ranks:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
