import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const t0 = performance.now();

    // 1. Group 1: Core Aggregates
    const [
      totalStudents,
      activeCodechefCount,
      activeLeetcodeCount,
      activeGithubCount,
      activeOverallCount,
      ratingAgg,
    ] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.codechefProfile.count({ where: { username: { not: "" }, currentRating: { not: null } } }),
      prisma.leetcodeProfile.count({ where: { username: { not: "" }, problemsSolved: { not: null } } }),
      prisma.githubProfile.count({ where: { username: { not: "" }, totalRepositories: { not: null } } }),
      prisma.studentProfile.count({
        where: { OR: [{ codechefProfile: { isNot: null } }, { leetcodeProfile: { isNot: null } }, { githubProfile: { isNot: null } }] }
      }),
      prisma.leaderboardEntry.aggregate({
        where: { OR: [{ student: { codechefUsername: { not: null } } }, { student: { leetcodeUsername: { not: null } } }, { student: { githubUsername: { not: null } } }] },
        _avg: { overallScore: true }, _max: { overallScore: true }
      })
    ]);

    const [
      leetcodeAgg,
      githubAgg,
      codechefAgg,
      lcSolvedAgg,
      ccProfileAgg,
      ghProfileAgg,
    ] = await Promise.all([
      prisma.leaderboardEntry.aggregate({ where: { student: { leetcodeUsername: { not: null } } }, _avg: { leetcodeScore: true } }),
      prisma.leaderboardEntry.aggregate({ where: { student: { githubUsername: { not: null } } }, _avg: { githubScore: true } }),
      prisma.leaderboardEntry.aggregate({ where: { student: { codechefUsername: { not: null } } }, _avg: { codechefScore: true } }),
      prisma.leetcodeProfile.aggregate({ _avg: { problemsSolved: true, acceptanceRate: true } }),
      prisma.codechefProfile.aggregate({ _avg: { currentRating: true, stars: true, contestCount: true } }),
      prisma.githubProfile.aggregate({ _avg: { totalRepositories: true, totalStars: true, openSourceScore: true } })
    ]);

    const [
      activeContestParticipants,
      fourStarCoders,
      fiveStarCoders,
      deptCounts,
      activeStudents,
    ] = await Promise.all([
      prisma.leaderboardEntry.count({ where: { OR: [{ rating: { gt: 0 } }, { leetcodeScore: { gt: 0 } }] } }),
      prisma.leaderboardEntry.count({ where: { overallScore: { gte: 70, lt: 85 } } }),
      prisma.leaderboardEntry.count({ where: { overallScore: { gte: 85 } } }),
      prisma.studentProfile.groupBy({
        by: ["department"],
        where: { OR: [{ codechefProfile: { isNot: null } }, { leetcodeProfile: { isNot: null } }, { githubProfile: { isNot: null } }] },
        _count: { id: true },
      }),
      prisma.leaderboardEntry.findMany({
        where: { OR: [{ student: { codechefUsername: { not: null } } }, { student: { leetcodeUsername: { not: null } } }, { student: { githubUsername: { not: null } } }] },
        select: { overallScore: true },
      })
    ]);

    // 2. Group 2: Yesterday's Stats
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      yesterdayTotalStudents,
      yesterdayActiveCodechef,
      yesterdayRatingAgg,
      yesterdayActiveContestParticipants,
      yesterdayFourStar,
      yesterdayFiveStar
    ] = await Promise.all([
      prisma.studentProfile.count({ where: { createdAt: { lt: yesterdayDate } } }),
      prisma.codechefProfile.count({ where: { createdAt: { lt: yesterdayDate } } }),
      prisma.leaderboardEntry.aggregate({
        where: {
          OR: [{ student: { codechefUsername: { not: null } } }, { student: { leetcodeUsername: { not: null } } }, { student: { githubUsername: { not: null } } }],
          updatedAt: { lt: yesterdayDate }
        },
        _avg: { overallScore: true },
      }),
      prisma.codechefProfile.count({ where: { createdAt: { lt: yesterdayDate } } }),
      prisma.leaderboardEntry.count({ where: { overallScore: { gte: 70, lt: 85 }, updatedAt: { lt: yesterdayDate } } }),
      prisma.leaderboardEntry.count({ where: { overallScore: { gte: 85 }, updatedAt: { lt: yesterdayDate } } })
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
      ? Math.round((activeCodechefCount / totalStudents) * 100)
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

    let totalPlacementReadyScore = 0;
    activeStudents.forEach((entry) => {
      totalPlacementReadyScore += entry.overallScore;
    });
    const placementReadinessIndex = activeStudents.length > 0
      ? Math.round(totalPlacementReadyScore / activeStudents.length)
      : 0;

    const yesterdayAverageRating = Math.round(yesterdayRatingAgg._avg.overallScore || 0);
    const yesterdayParticipationPercent = yesterdayTotalStudents > 0
      ? Math.round((yesterdayActiveContestParticipants / yesterdayTotalStudents) * 100)
      : 0;
    const yesterdayPlacementReadinessIndex = yesterdayAverageRating;

    const formatPctTrend = (current: number, prev: number) => {
      if (prev === 0) return "No historical data available";
      const diff = current - prev;
      if (diff === 0) return "0% vs yesterday";
      const pct = (diff / prev) * 100;
      return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs yesterday`;
    };

    const formatDiffTrend = (current: number, prev: number, label: string) => {
      if (prev === 0) return "No historical data available";
      const diff = current - prev;
      if (diff === 0) return `0 ${label} vs yesterday`;
      return `${diff > 0 ? "+" : ""}${diff} ${label} vs yesterday`;
    };

    const formatIndexTrend = (current: number, prev: number) => {
      if (prev === 0) return "No historical data available";
      const diff = current - prev;
      if (diff === 0) return "0% vs yesterday";
      return `${diff > 0 ? "+" : ""}${diff.toFixed(1)}% vs yesterday`;
    };

    // 3. Dynamic Sparklines (6 intervals over last 5 days) executed sequentially
    const sparklines: Record<string, number[]> = {
        totalStudents: [], activeProfiles: [], averageRating: [], participationPercent: [],
        placementIndex: [], fourStar: [], fiveStar: [], highestRating: [], topDept: [],
        averageTalentScore: [], averageCPScore: [], averageConsistencyScore: [],
        averageProblemsSolved: [], averageContestParticipation: []
    };

    const sparklineResults = [];
    for (let i = 5; i >= 0; i--) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - i);
      dateLimit.setHours(23, 59, 59, 999);

      const [sCount, ccCount, rAggLimit, talentS, cpS, consS, f4Count, f5Count, tdCount, hrAggLimit] = await Promise.all([
        prisma.studentProfile.count({ where: { createdAt: { lt: dateLimit } } }),
        prisma.codechefProfile.count({ where: { createdAt: { lt: dateLimit } } }),
        prisma.leaderboardEntry.aggregate({ where: { updatedAt: { lt: dateLimit } }, _avg: { overallScore: true } }),
        prisma.leaderboardEntry.aggregate({ where: { student: { codechefUsername: { not: null } }, updatedAt: { lt: dateLimit } }, _avg: { codechefScore: true } }),
        prisma.leaderboardEntry.aggregate({ where: { student: { leetcodeUsername: { not: null } }, updatedAt: { lt: dateLimit } }, _avg: { leetcodeScore: true } }),
        prisma.leaderboardEntry.aggregate({ where: { student: { githubUsername: { not: null } }, updatedAt: { lt: dateLimit } }, _avg: { githubScore: true } }),
        prisma.leaderboardEntry.count({ where: { overallScore: { gte: 70, lt: 85 }, updatedAt: { lt: dateLimit } } }),
        prisma.leaderboardEntry.count({ where: { overallScore: { gte: 85 }, updatedAt: { lt: dateLimit } } }),
        topDepartment !== "Unknown" ? prisma.studentProfile.count({ where: { department: topDepartment, createdAt: { lt: dateLimit } } }) : Promise.resolve(0),
        prisma.leaderboardEntry.aggregate({ where: { updatedAt: { lt: dateLimit } }, _max: { overallScore: true } })
      ]);

      const avgVal = Math.round(rAggLimit._avg.overallScore || 0);
      const pRate = sCount > 0 ? Math.round((ccCount / sCount) * 100) : 0;
      
      sparklineResults.push({
        sCount, ccCount, avgVal,
        talentScore: Math.round(talentS._avg.codechefScore || 0),
        cpScore: Math.round(cpS._avg.leetcodeScore || 0),
        consScore: Math.round(consS._avg.githubScore || 0),
        pRate, f4Count, f5Count, tdCount,
        highestRating: Math.round(hrAggLimit._max.overallScore || 0)
      });
    }
    
    sparklineResults.forEach(res => {
      sparklines.totalStudents.push(res.sCount);
      sparklines.activeProfiles.push(res.ccCount);
      sparklines.averageRating.push(res.avgVal);
      sparklines.averageTalentScore.push(res.talentScore);
      sparklines.averageCPScore.push(res.cpScore);
      sparklines.averageConsistencyScore.push(res.consScore);
      sparklines.averageProblemsSolved.push(lcProblemsSolvedAvg); // Constant
      sparklines.averageContestParticipation.push(ccContestCountAvg); // Constant
      sparklines.participationPercent.push(res.pRate);
      sparklines.placementIndex.push(res.avgVal);
      sparklines.fourStar.push(res.f4Count);
      sparklines.fiveStar.push(res.f5Count);
      sparklines.topDept.push(res.tdCount);
      sparklines.highestRating.push(res.highestRating);
    });

    // 4. Fetch Top Performers
    const topPerformers = await prisma.leaderboardEntry.findMany({
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
    
    const t1 = performance.now();
    console.log(`[Dashboard Stats API] Completed in ${(t1 - t0).toFixed(2)}ms`);

    return NextResponse.json({
      stats: {
        totalStudents: { value: totalStudents, trend: formatPctTrend(totalStudents, yesterdayTotalStudents), sparkline: sparklines.totalStudents },
        activeCodechef: { value: activeCodechefCount, trend: formatPctTrend(activeCodechefCount, yesterdayActiveCodechef), sparkline: sparklines.activeProfiles },
        activeLeetcode: { value: activeLeetcodeCount, trend: "LeetCode Active", sparkline: sparklines.activeProfiles },
        activeGithub: { value: activeGithubCount, trend: "GitHub Active", sparkline: sparklines.activeProfiles },
        activeOverall: { value: activeOverallCount, trend: "Overall Active Profiles", sparkline: sparklines.activeProfiles },
        averageRating: { value: averageRating, trend: formatDiffTrend(averageRating, yesterdayAverageRating, "pts"), sparkline: sparklines.averageRating },
        activeContestParticipants: { value: activeContestParticipants, trend: formatDiffTrend(activeContestParticipants, yesterdayActiveContestParticipants, "active"), sparkline: sparklines.participationPercent },
        fourStarCoders: { value: fourStarCoders, trend: formatDiffTrend(fourStarCoders, yesterdayFourStar, "coders"), sparkline: sparklines.fourStar },
        fiveStarCoders: { value: fiveStarCoders, trend: formatDiffTrend(fiveStarCoders, yesterdayFiveStar, "coders"), sparkline: sparklines.fiveStar },
        highestRating: { value: highestRating, trend: "Peak record", sparkline: sparklines.highestRating },
        topDepartment: { value: topDepartment, trend: topDepartment !== "Unknown" ? `${maxDeptCount} students` : "No data", sparkline: sparklines.topDept },
        contestParticipationPercent: { value: contestParticipationPercent, trend: formatIndexTrend(contestParticipationPercent, yesterdayParticipationPercent), sparkline: sparklines.participationPercent },
        placementReadinessIndex: { value: placementReadinessIndex, trend: formatIndexTrend(placementReadinessIndex, yesterdayPlacementReadinessIndex), sparkline: sparklines.placementIndex },
        averageTalentScore: { value: Math.round(codechefAgg._avg.codechefScore || 0), trend: "CodeChef Avg", sparkline: sparklines.averageTalentScore },
        averageCPScore: { value: Math.round(leetcodeAgg._avg.leetcodeScore || 0), trend: "LeetCode Avg", sparkline: sparklines.averageCPScore },
        averageConsistencyScore: { value: Math.round(githubAgg._avg.githubScore || 0), trend: "GitHub Avg", sparkline: sparklines.averageConsistencyScore },
        averageProblemsSolved: { value: lcProblemsSolvedAvg, trend: "", sparkline: sparklines.averageProblemsSolved },
        averageContestParticipation: { value: ccContestCountAvg, trend: "", sparkline: sparklines.averageContestParticipation },
        averageCodechefRating: { value: ccRatingAvg, trend: "", sparkline: sparklines.averageRating },
        averageCodechefStars: { value: ccStarsAvg, trend: "", sparkline: [ccStarsAvg, ccStarsAvg, ccStarsAvg, ccStarsAvg, ccStarsAvg, ccStarsAvg] },
        averageRepositories: { value: ghRepositoriesAvg, trend: "", sparkline: [0, 0, 0, 0, 0, 0] },
        averageStars: { value: ghStarsAvg, trend: "", sparkline: [0, 0, 0, 0, 0, 0] },
        averageOpenSourceScore: { value: ghOpenSourceAvg, trend: "", sparkline: [0, 0, 0, 0, 0, 0] },
        averageAcceptanceRate: { value: lcAcceptanceRateAvg, trend: "", sparkline: [0, 0, 0, 0, 0, 0] }
      },
      departmentDistribution,
      topPerformers,
      globalActivityHeatmap: {},
    });
  } catch (err: any) {
    console.error("Error in stats api:", err);
    return NextResponse.json({ error: "Failed to load stats details" }, { status: 500 });
  }
}
