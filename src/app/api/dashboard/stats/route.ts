import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { requireDashboardAccess } from "@/lib/auth";
import { BulkSyncService } from "@/services/bulkSync.service";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const getCachedStats = async (departmentFilter?: string) => {
  return unstable_cache(
    async () => {
      const studentWhere = departmentFilter ? { department: departmentFilter } : {};
      
      // Strict filter for competitive performance statistics: ONLY verified, approved and dashboardEligible students!
      const lbWhere = departmentFilter
        ? { student: { department: departmentFilter, dashboardEligible: true, profileStatus: "VERIFIED", adminApprovalStatus: "APPROVED" } }
        : { student: { dashboardEligible: true, profileStatus: "VERIFIED", adminApprovalStatus: "APPROVED" } };

      // 1. Core Profile Status Counts
      const [
        totalStudents,
        verifiedCount,
        pendingVerificationCount,
        incompleteCount,
        failedCount,
        codechefVerifiedCount,
        leetcodeVerifiedCount,
        bothPlatformsVerifiedCount,
        awaitingApprovalCount,
        approvedCount,
        rejectedCount,
        allProfiles,
      ] = await Promise.all([
        prisma.studentProfile.count({ where: studentWhere }),
        prisma.studentProfile.count({ where: { ...studentWhere, profileStatus: "VERIFIED" } }),
        prisma.studentProfile.count({ where: { ...studentWhere, profileStatus: "PENDING_VERIFICATION" } }),
        prisma.studentProfile.count({ where: { ...studentWhere, profileStatus: "INCOMPLETE" } }),
        prisma.studentProfile.count({ where: { ...studentWhere, profileStatus: "INVALID" } }),
        prisma.codechefProfile.count({ where: { student: studentWhere } }),
        prisma.leetcodeProfile.count({ where: { student: studentWhere } }),
        prisma.studentProfile.count({
          where: {
            ...studentWhere,
            codechefProfile: { isNot: null },
            leetcodeProfile: { isNot: null },
            profileStatus: "VERIFIED",
          },
        }),
        prisma.studentProfile.count({ where: { ...studentWhere, profileStatus: "VERIFIED", adminApprovalStatus: "PENDING" } }),
        prisma.studentProfile.count({ where: { ...studentWhere, adminApprovalStatus: "APPROVED" } }),
        prisma.studentProfile.count({ where: { ...studentWhere, adminApprovalStatus: "REJECTED" } }),
        prisma.studentProfile.findMany({
          where: studentWhere,
          select: {
            id: true,
            profileStatus: true,
            adminApprovalStatus: true,
            codechefUsername: true,
            leetcodeUsername: true,
          },
        }),
      ]);

      // Queue Progress Stats
      const queueProgress = await BulkSyncService.getQueueProgressStats();
      const exclusiveStageCounts = BulkSyncService.getExclusiveStageCounts(allProfiles as any);
      const exclusiveSum = Object.values(exclusiveStageCounts).reduce((sum, value) => sum + value, 0);

      // 2. Competitive Performance Metrics (Filtered STRICTLY to VERIFIED students)
      const [ratingAgg, leetcodeAgg, codechefAgg, lcSolvedAgg, ccProfileAgg, ghProfileAgg] = await Promise.all([
        prisma.leaderboardEntry.aggregate({
          where: lbWhere,
          _avg: { overallScore: true },
          _max: { overallScore: true },
        }),
        prisma.leaderboardEntry.aggregate({
          where: lbWhere,
          _avg: { leetcodeScore: true },
        }),
        prisma.leaderboardEntry.aggregate({
          where: lbWhere,
          _avg: { codechefScore: true },
        }),
        prisma.leetcodeProfile.aggregate({
          where: { student: { ...studentWhere, profileStatus: "VERIFIED", dashboardEligible: true, adminApprovalStatus: "APPROVED" } },
          _avg: { problemsSolved: true, acceptanceRate: true },
        }),
        prisma.codechefProfile.aggregate({
          where: { student: { ...studentWhere, profileStatus: "VERIFIED", dashboardEligible: true, adminApprovalStatus: "APPROVED" } },
          _avg: { currentRating: true, stars: true, contestCount: true },
        }),
        prisma.githubProfile.aggregate({
          where: { student: { ...studentWhere, profileStatus: "VERIFIED", dashboardEligible: true, adminApprovalStatus: "APPROVED" } },
          _avg: { totalRepositories: true, totalStars: true, openSourceScore: true },
        }),
      ]);

      const [activeContestParticipants, fourStarCoders, fiveStarCoders, deptCounts] = await Promise.all([
        prisma.leaderboardEntry.count({
          where: { ...lbWhere, OR: [{ rating: { gt: 0 } }, { leetcodeScore: { gt: 0 } }] },
        }),
        prisma.leaderboardEntry.count({ where: { ...lbWhere, overallScore: { gte: 70, lt: 85 } } }),
        prisma.leaderboardEntry.count({ where: { ...lbWhere, overallScore: { gte: 85 } } }),
        prisma.studentProfile.groupBy({
          by: ["department"],
          where: { ...studentWhere, profileStatus: "VERIFIED", dashboardEligible: true, adminApprovalStatus: "APPROVED" },
          _count: { id: true },
        }),
      ]);

      const averageRating = Math.round(ratingAgg._avg.overallScore || 0);
      const highestRating = Math.round(ratingAgg._max.overallScore || 0);

      const lcProblemsSolvedAvg = Math.round(lcSolvedAgg._avg.problemsSolved || 0);
      const lcAcceptanceRateAvg = Math.round(lcSolvedAgg._avg.acceptanceRate || 0);
      const ccRatingAvg = Math.round(ccProfileAgg._avg.currentRating || 0);
      const ccStarsAvg = Math.round(ccProfileAgg._avg.stars || 0);
      const ccContestCountAvg = Math.round(ccProfileAgg._avg.contestCount || 0);
      const ghRepositoriesAvg = Math.round(ghProfileAgg._avg.totalRepositories || 0);
      const ghStarsAvg = Math.round(ghProfileAgg._avg.totalStars || 0);
      const ghOpenSourceAvg = Math.round(ghProfileAgg._avg.openSourceScore || 0);

      const contestParticipationPercent = totalStudents > 0
        ? Math.round((verifiedCount / totalStudents) * 100)
        : 0;

      let topDepartment = "Unknown";
      let maxDeptCount = 0;
      deptCounts.forEach((group) => {
        const deptName = group.department ? group.department.trim() : "Unknown";
        const count = group._count.id;
        if (count > maxDeptCount && deptName !== "" && deptName !== "Unknown") {
          maxDeptCount = count;
          topDepartment = deptName;
        }
      });

      const departmentDistribution = deptCounts.map((d) => ({
        name: d.department || "Unknown",
        value: d._count.id,
      }));

      // Top 5 Performers (strictly from verified leaderboard)
      const topPerformers = await prisma.leaderboardEntry.findMany({
        where: lbWhere,
        orderBy: { overallScore: "desc" },
        take: 5,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              department: true,
            },
          },
        },
      });

      return {
        stats: {
          totalStudents: { value: totalStudents, trend: "", sparkline: [totalStudents, totalStudents] },
          verifiedCount: { value: verifiedCount, trend: "Verified competitive profiles", sparkline: [verifiedCount, verifiedCount] },
          pendingVerificationCount: { value: pendingVerificationCount, trend: "Pending verification", sparkline: [pendingVerificationCount, pendingVerificationCount] },
          incompleteCount: { value: incompleteCount, trend: "Incomplete profiles", sparkline: [incompleteCount, incompleteCount] },
          failedCount: { value: failedCount, trend: "Failed / invalid verification", sparkline: [failedCount, failedCount] },
          codechefVerifiedCount: { value: codechefVerifiedCount, trend: "CodeChef profiles", sparkline: [codechefVerifiedCount, codechefVerifiedCount] },
          leetcodeVerifiedCount: { value: leetcodeVerifiedCount, trend: "LeetCode profiles", sparkline: [leetcodeVerifiedCount, leetcodeVerifiedCount] },
          bothPlatformsVerifiedCount: { value: bothPlatformsVerifiedCount, trend: "Both platforms verified", sparkline: [bothPlatformsVerifiedCount, bothPlatformsVerifiedCount] },
          awaitingApprovalCount: { value: awaitingApprovalCount, trend: "Awaiting Admin Approval", sparkline: [awaitingApprovalCount, awaitingApprovalCount] },
          approvedCount: { value: approvedCount, trend: "Approved students", sparkline: [approvedCount, approvedCount] },
          rejectedCount: { value: rejectedCount, trend: "Rejected students", sparkline: [rejectedCount, rejectedCount] },
          stageBreakdown: {
            value: exclusiveStageCounts,
            trend: "Exclusive stage totals",
            sparkline: [exclusiveSum, exclusiveSum],
          },
          activeCodechef: { value: codechefVerifiedCount, trend: "", sparkline: [codechefVerifiedCount, codechefVerifiedCount] },
          activeLeetcode: { value: leetcodeVerifiedCount, trend: "", sparkline: [leetcodeVerifiedCount, leetcodeVerifiedCount] },
          activeGithub: { value: ghRepositoriesAvg > 0 ? verifiedCount : 0, trend: "", sparkline: [0, 0] },
          activeOverall: { value: verifiedCount, trend: "", sparkline: [verifiedCount, verifiedCount] },
          averageRating: { value: averageRating, trend: "", sparkline: [averageRating, averageRating] },
          activeContestParticipants: { value: activeContestParticipants, trend: "", sparkline: [activeContestParticipants, activeContestParticipants] },
          fourStarCoders: { value: fourStarCoders, trend: "", sparkline: [fourStarCoders, fourStarCoders] },
          fiveStarCoders: { value: fiveStarCoders, trend: "", sparkline: [fiveStarCoders, fiveStarCoders] },
          highestRating: { value: highestRating, trend: "", sparkline: [highestRating, highestRating] },
          topDepartment: { value: topDepartment, trend: topDepartment !== "Unknown" ? `${maxDeptCount} verified` : "No data", sparkline: [maxDeptCount, maxDeptCount] },
          contestParticipationPercent: { value: contestParticipationPercent, trend: "", sparkline: [contestParticipationPercent, contestParticipationPercent] },
          placementReadinessIndex: { value: averageRating, trend: "", sparkline: [averageRating, averageRating] },
          averageTalentScore: { value: Math.round(codechefAgg._avg.codechefScore || 0), trend: "", sparkline: [] },
          averageCPScore: { value: Math.round(leetcodeAgg._avg.leetcodeScore || 0), trend: "", sparkline: [] },
          averageConsistencyScore: { value: 0, trend: "", sparkline: [] },
          averageProblemsSolved: { value: lcProblemsSolvedAvg, trend: "", sparkline: [] },
          averageContestParticipation: { value: ccContestCountAvg, trend: "", sparkline: [] },
          averageCodechefRating: { value: ccRatingAvg, trend: "", sparkline: [] },
          averageCodechefStars: { value: ccStarsAvg, trend: "", sparkline: [] },
          averageRepositories: { value: ghRepositoriesAvg, trend: "", sparkline: [] },
          averageStars: { value: ghStarsAvg, trend: "", sparkline: [] },
          averageOpenSourceScore: { value: ghOpenSourceAvg, trend: "", sparkline: [] },
          averageAcceptanceRate: { value: lcAcceptanceRateAvg, trend: "", sparkline: [] },
        },
        queueProgress,
        departmentDistribution,
        topPerformers,
        globalActivityHeatmap: {},
      };
    },
    [`dashboard-stats-cache-${departmentFilter || "ALL"}`],
    { revalidate: 30 }
  )();
};

export async function GET(request: NextRequest) {
  try {
    const userAccess = await requireDashboardAccess();
    const departmentFilter = userAccess.role === UserRole.HOD ? userAccess.departmentId || undefined : undefined;
    const data = await getCachedStats(departmentFilter);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    console.error("Error in stats api:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Failed to load stats details" }, { status: 500 });
  }
}
