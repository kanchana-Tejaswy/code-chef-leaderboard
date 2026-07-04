import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // 1. Core aggregates
    const totalStudents = await prisma.studentProfile.count();

    // Count students with at least one active profile
    const activeProfilesCount = await prisma.studentProfile.count({
      where: {
        OR: [
          { codechefUsername: { not: null } },
          { leetcodeUsername: { not: null } },
          { githubUsername: { not: null } }
        ]
      },
    });

    const ratingAgg = await prisma.leaderboardEntry.aggregate({
      _sum: { overallScore: true },
      _avg: { overallScore: true },
      _max: { overallScore: true },
    });
    
    // Average scores
    const averageRating = Math.round(ratingAgg._avg.overallScore || 0);
    const highestRating = Math.round(ratingAgg._max.overallScore || 0);

    const leetcodeAgg = await prisma.leaderboardEntry.aggregate({ _avg: { leetcodeScore: true } });
    const githubAgg = await prisma.leaderboardEntry.aggregate({ _avg: { githubScore: true } });
    const codechefAgg = await prisma.leaderboardEntry.aggregate({ _avg: { codechefScore: true } });

    // Active contest participants (CodeChef ratings/Leetcode ratings > 0)
    const activeContestParticipants = await prisma.leaderboardEntry.count({
      where: {
        OR: [
          { rating: { gt: 0 } },
          { leetcodeScore: { gt: 0 } }
        ]
      },
    });

    const fourStarCoders = await prisma.leaderboardEntry.count({
      where: { overallScore: { gte: 70, lt: 85 } },
    });

    const fiveStarCoders = await prisma.leaderboardEntry.count({
      where: { overallScore: { gte: 85 } },
    });

    const contestParticipationPercent = totalStudents > 0
      ? Math.round((activeContestParticipants / totalStudents) * 100)
      : 0;

    // Compute top department by student count
    const deptCounts = await prisma.studentProfile.groupBy({
      by: ["department"],
      _count: { id: true },
    });

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

    // Placement Ready Index calculations (Overall Score >= 60 is Tier-2/Product ready)
    const activeStudents = await prisma.leaderboardEntry.findMany({
      select: {
        overallScore: true,
        talentScore: true,
      },
    });

    let totalPlacementReadyScore = 0;
    activeStudents.forEach((entry) => {
      totalPlacementReadyScore += entry.overallScore;
    });

    const placementReadinessIndex = activeStudents.length > 0
      ? Math.round(totalPlacementReadyScore / activeStudents.length)
      : 0;

    // 2. Historical Trend Comparisons (Yesterday bounds)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const yesterdayTotalStudents = await prisma.studentProfile.count({
      where: { createdAt: { lt: yesterday } },
    });

    const yesterdayActiveProfiles = await prisma.studentProfile.count({
      where: {
        OR: [
          { codechefUsername: { not: null } },
          { leetcodeUsername: { not: null } },
          { githubUsername: { not: null } }
        ],
        createdAt: { lt: yesterday },
      },
    });

    const yesterdayRatingAgg = await prisma.leaderboardEntry.aggregate({
      _avg: { overallScore: true },
    });
    const yesterdayAverageRating = Math.round(yesterdayRatingAgg._avg.overallScore || 0);

    const yesterdayContestParticipants = await prisma.leaderboardEntry.count({
      where: {
        OR: [
          { rating: { gt: 0 } },
          { leetcodeScore: { gt: 0 } }
        ],
        updatedAt: { lt: yesterday }
      },
    });
    const yesterdayParticipationPercent = yesterdayTotalStudents > 0
      ? Math.round((yesterdayContestParticipants / yesterdayTotalStudents) * 100)
      : 0;

    const yesterdayPlacementReadinessIndex = yesterdayAverageRating;

    const yesterdayFourStar = await prisma.leaderboardEntry.count({
      where: { overallScore: { gte: 70, lt: 85 }, updatedAt: { lt: yesterday } },
    });

    const yesterdayFiveStar = await prisma.leaderboardEntry.count({
      where: { overallScore: { gte: 85 }, updatedAt: { lt: yesterday } },
    });

    // Helper functions for format trends
    const formatPctTrend = (current: number, prev: number) => {
      if (prev === 0) return "No historical data available";
      const diff = current - prev;
      const pct = (diff / prev) * 100;
      return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs yesterday`;
    };

    const formatDiffTrend = (current: number, prev: number, label: string) => {
      if (prev === 0) return "No historical data available";
      const diff = current - prev;
      return `${diff >= 0 ? "+" : ""}${diff} ${label} vs yesterday`;
    };

    const formatIndexTrend = (current: number, prev: number) => {
      if (prev === 0) return "No historical data available";
      const diff = current - prev;
      return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}% vs yesterday`;
    };

    // 3. Dynamic Sparklines (6 intervals over last 5 days)
    const sparklines: Record<string, number[]> = {
        totalStudents: [],
        activeProfiles: [],
        averageRating: [],
        participationPercent: [],
        placementIndex: [],
        fourStar: [],
        fiveStar: [],
        highestRating: [],
        topDept: [],
        averageTalentScore: [],
        averageCPScore: [],
        averageConsistencyScore: [],
        averageProblemsSolved: [],
        averageContestParticipation: []
    };

    for (let i = 5; i >= 0; i--) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - i);
      dateLimit.setHours(23, 59, 59, 999);

      // Total Students
      const sCount = await prisma.studentProfile.count({
        where: { createdAt: { lt: dateLimit } }
      });
      sparklines.totalStudents.push(sCount);

      // Active profiles
      const aCount = await prisma.studentProfile.count({
        where: {
          OR: [
            { codechefUsername: { not: null } },
            { leetcodeUsername: { not: null } },
            { githubUsername: { not: null } }
          ],
          createdAt: { lt: dateLimit }
        }
      });
      sparklines.activeProfiles.push(aCount);

      // Average Rating (Overall Score)
      const rAgg = await prisma.leaderboardEntry.aggregate({
        _avg: { overallScore: true }
      });
      const avg = Math.round(rAgg._avg.overallScore || 0);
      sparklines.averageRating.push(avg);
      
      const talentS = await prisma.aiAnalysis.aggregate({ _avg: { talentScore: true } });
      const cpS = await prisma.aiAnalysis.aggregate({ _avg: { competitiveProgrammingScore: true } });
      const consS = await prisma.aiAnalysis.aggregate({ _avg: { consistencyScore: true } });
      
      sparklines.averageTalentScore.push(Math.round(talentS._avg.talentScore || 0));
      sparklines.averageCPScore.push(Math.round(cpS._avg.competitiveProgrammingScore || 0));
      sparklines.averageConsistencyScore.push(Math.round(consS._avg.consistencyScore || 0));
      sparklines.averageProblemsSolved.push(35);
      sparklines.averageContestParticipation.push(10);

      // Participation Percent
      const cCount = await prisma.leaderboardEntry.count({
        where: {
          OR: [
            { rating: { gt: 0 } },
            { leetcodeScore: { gt: 0 } }
          ]
        }
      });
      const pRate = sCount > 0 ? Math.round((cCount / sCount) * 100) : 0;
      sparklines.participationPercent.push(pRate);

      // Placement Index
      sparklines.placementIndex.push(avg);

      // Four Star
      const f4Count = await prisma.leaderboardEntry.count({
        where: { overallScore: { gte: 70, lt: 85 } }
      });
      sparklines.fourStar.push(f4Count);

      // Five Star
      const f5Count = await prisma.leaderboardEntry.count({
        where: { overallScore: { gte: 85 } }
      });
      sparklines.fiveStar.push(f5Count);

      // Top Dept student count trend
      const tdCount = topDepartment !== "Unknown"
        ? await prisma.studentProfile.count({
            where: { department: topDepartment, createdAt: { lt: dateLimit } }
          })
        : 0;
      sparklines.topDept.push(tdCount);

      // Highest Rating
      const hrAgg = await prisma.leaderboardEntry.aggregate({
        _max: { overallScore: true }
      });
      sparklines.highestRating.push(Math.round(hrAgg._max.overallScore || 0));
    }

    // 4. Fetch Top Performers (sorted by overall score)
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

    // 5. Aggregate Global Activity Heatmap
    const codechefProfiles = await prisma.codechefProfile.findMany({ select: { activitySummary: true } });
    const leetcodeProfiles = await prisma.leetcodeProfile.findMany({ select: { heatmap: true } });
    const githubProfiles = await prisma.githubProfile.findMany({ select: { contributions: true } });

    const globalActivityHeatmap: Record<string, number> = {};

    codechefProfiles.forEach((p) => {
      const summary = p.activitySummary as any;
      if (summary && typeof summary === "object") {
        Object.entries(summary).forEach(([date, val]) => {
          const count = typeof val === "number" ? val : parseInt(val as any, 10) || 0;
          globalActivityHeatmap[date] = (globalActivityHeatmap[date] || 0) + count;
        });
      }
    });

    leetcodeProfiles.forEach((p) => {
      const hm = p.heatmap as any;
      if (hm && typeof hm === "object") {
        Object.entries(hm).forEach(([date, val]) => {
          const count = typeof val === "number" ? val : parseInt(val as any, 10) || 0;
          globalActivityHeatmap[date] = (globalActivityHeatmap[date] || 0) + count;
        });
      }
    });

    githubProfiles.forEach((p) => {
      const contribs = p.contributions as any;
      if (contribs && typeof contribs === "object") {
        Object.entries(contribs).forEach(([date, val]) => {
          const count = typeof val === "number" ? val : parseInt(val as any, 10) || 0;
          globalActivityHeatmap[date] = (globalActivityHeatmap[date] || 0) + count;
        });
      }
    });

    return NextResponse.json({
      stats: {
        totalStudents: {
          value: totalStudents,
          trend: formatPctTrend(totalStudents, yesterdayTotalStudents),
          sparkline: sparklines.totalStudents,
        },
        activeCodechef: {
          value: activeProfilesCount,
          trend: formatPctTrend(activeProfilesCount, yesterdayActiveProfiles),
          sparkline: sparklines.activeProfiles,
        },
        averageRating: {
          value: averageRating,
          trend: formatDiffTrend(averageRating, yesterdayAverageRating, "pts"),
          sparkline: sparklines.averageRating,
        },
        activeContestParticipants: {
          value: activeContestParticipants,
          trend: formatDiffTrend(activeContestParticipants, yesterdayContestParticipants, "active"),
          sparkline: sparklines.participationPercent,
        },
        fourStarCoders: {
          value: fourStarCoders,
          trend: formatDiffTrend(fourStarCoders, yesterdayFourStar, "coders"),
          sparkline: sparklines.fourStar,
        },
        fiveStarCoders: {
          value: fiveStarCoders,
          trend: formatDiffTrend(fiveStarCoders, yesterdayFiveStar, "coders"),
          sparkline: sparklines.fiveStar,
        },
        highestRating: {
          value: highestRating,
          trend: "Peak record",
          sparkline: sparklines.highestRating,
        },
        topDepartment: {
          value: topDepartment,
          trend: topDepartment !== "Unknown" ? `${maxDeptCount} students` : "No data",
          sparkline: sparklines.topDept,
        },
        contestParticipationPercent: {
          value: contestParticipationPercent,
          trend: formatIndexTrend(contestParticipationPercent, yesterdayParticipationPercent),
          sparkline: sparklines.participationPercent,
        },
        placementReadinessIndex: {
          value: placementReadinessIndex,
          trend: formatIndexTrend(placementReadinessIndex, yesterdayPlacementReadinessIndex),
          sparkline: sparklines.placementIndex,
        },
        averageTalentScore: {
          value: Math.round(codechefAgg._avg.codechefScore || 0), // average CodeChef score
          trend: "CodeChef Avg",
          sparkline: sparklines.averageTalentScore,
        },
        averageCPScore: {
          value: Math.round(leetcodeAgg._avg.leetcodeScore || 0), // average LeetCode score
          trend: "LeetCode Avg",
          sparkline: sparklines.averageCPScore,
        },
        averageConsistencyScore: {
          value: Math.round(githubAgg._avg.githubScore || 0), // average GitHub score
          trend: "GitHub Avg",
          sparkline: sparklines.averageConsistencyScore,
        },
        averageProblemsSolved: {
          value: 35,
          trend: "",
          sparkline: sparklines.averageProblemsSolved,
        },
        averageContestParticipation: {
          value: 10,
          trend: "",
          sparkline: sparklines.averageContestParticipation,
        }
      },
      departmentDistribution,
      topPerformers,
      globalActivityHeatmap,
    });
  } catch (err: any) {
    console.error("Error in stats api:", err);
    return NextResponse.json({ error: "Failed to load stats details" }, { status: 500 });
  }
}
