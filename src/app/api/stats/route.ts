import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // 1. Core aggregates
    const totalStudents = await prisma.studentProfile.count();

    // Count students with valid CodeChef profiles and AI Reports
    const activeProfilesCount = await prisma.studentProfile.count({
      where: {
        codechefUsername: { not: null },
        codechefProfile: { isNot: null },
        aiAnalysis: { isNot: null },
      },
    });

    const ratingSumResult = await prisma.codechefProfile.aggregate({
      _sum: {
        currentRating: true,
      },
      _max: {
        currentRating: true,
      },
    });

    const totalRating = ratingSumResult._sum.currentRating || 0;
    const averageRating = activeProfilesCount > 0 ? Math.round(totalRating / activeProfilesCount) : 0;
    const highestRating = ratingSumResult._max.currentRating || 0;

    const activeContestParticipants = await prisma.codechefProfile.count({
      where: {
        contestCount: { gt: 0 },
      },
    });

    const fourStarCoders = await prisma.codechefProfile.count({
      where: {
        stars: 4,
      },
    });

    const fiveStarCoders = await prisma.codechefProfile.count({
      where: {
        stars: { gte: 5 },
      },
    });

    const contestParticipationPercent = totalStudents > 0
      ? Math.round((activeContestParticipants / totalStudents) * 100)
      : 0;

    // Compute top department by student count
    const deptCounts = await prisma.studentProfile.groupBy({
      by: ["department"],
      _count: {
        id: true,
      },
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

    // Placement Ready Index calculations
    const activeStudents = await prisma.studentProfile.findMany({
      where: {
        codechefProfile: { isNot: null },
        aiAnalysis: { isNot: null },
      },
      include: {
        codechefProfile: true,
        aiAnalysis: true,
      },
    });

    let totalPlacementReadyScore = 0;
    activeStudents.forEach((student) => {
      const rating = student.codechefProfile?.currentRating || 0;
      const contestCount = student.codechefProfile?.contestCount || 0;
      const consistencyScore = student.aiAnalysis?.consistencyScore || 0;
      const talentScore = student.aiAnalysis?.talentScore || 0;

      const ratingScore = Math.min(100, Math.max(0, (rating / 2000) * 100));
      const contestScore = contestCount > 0 ? 100 : 0;
      const score = 0.4 * ratingScore + 0.2 * contestScore + 0.2 * consistencyScore + 0.2 * talentScore;
      totalPlacementReadyScore += score;
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
        codechefProfile: { isNot: null },
        aiAnalysis: { isNot: null },
        createdAt: { lt: yesterday },
      },
    });

    const yesterdayRatingAgg = await prisma.codechefProfile.aggregate({
      _sum: { currentRating: true },
      where: { createdAt: { lt: yesterday } },
    });
    const yesterdayAverageRating = yesterdayActiveProfiles > 0
      ? Math.round((yesterdayRatingAgg._sum.currentRating || 0) / yesterdayActiveProfiles)
      : 0;

    const yesterdayContestParticipants = await prisma.studentProfile.count({
      where: {
        codechefProfile: { contestCount: { gt: 0 } },
        createdAt: { lt: yesterday },
      },
    });
    const yesterdayParticipationPercent = yesterdayTotalStudents > 0
      ? Math.round((yesterdayContestParticipants / yesterdayTotalStudents) * 100)
      : 0;

    const yesterdayActiveStudents = await prisma.studentProfile.findMany({
      where: {
        codechefProfile: { isNot: null },
        aiAnalysis: { isNot: null },
        createdAt: { lt: yesterday },
      },
      include: {
        codechefProfile: true,
        aiAnalysis: true,
      },
    });
    let yesterdayTotalReadyScore = 0;
    yesterdayActiveStudents.forEach((student) => {
      const rating = student.codechefProfile?.currentRating || 0;
      const contestCount = student.codechefProfile?.contestCount || 0;
      const consistencyScore = student.aiAnalysis?.consistencyScore || 0;
      const talentScore = student.aiAnalysis?.talentScore || 0;

      const ratingScore = Math.min(100, Math.max(0, (rating / 2000) * 100));
      const contestScore = contestCount > 0 ? 100 : 0;
      const score = 0.4 * ratingScore + 0.2 * contestScore + 0.2 * consistencyScore + 0.2 * talentScore;
      yesterdayTotalReadyScore += score;
    });
    const yesterdayPlacementReadinessIndex = yesterdayActiveStudents.length > 0
      ? Math.round(yesterdayTotalReadyScore / yesterdayActiveStudents.length)
      : 0;

    const yesterdayFourStar = await prisma.codechefProfile.count({
      where: { stars: 4, createdAt: { lt: yesterday } },
    });

    const yesterdayFiveStar = await prisma.codechefProfile.count({
      where: { stars: { gte: 5 }, createdAt: { lt: yesterday } },
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
      topDept: [],
      highestRating: []
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
          codechefProfile: { isNot: null },
          aiAnalysis: { isNot: null },
          createdAt: { lt: dateLimit }
        }
      });
      sparklines.activeProfiles.push(aCount);

      // Average Rating
      const rAgg = await prisma.codechefProfile.aggregate({
        _sum: { currentRating: true },
        where: { createdAt: { lt: dateLimit } }
      });
      const avg = aCount > 0 ? Math.round((rAgg._sum.currentRating || 0) / aCount) : 0;
      sparklines.averageRating.push(avg);

      // Participation Percent
      const cCount = await prisma.studentProfile.count({
        where: {
          codechefProfile: { contestCount: { gt: 0 } },
          createdAt: { lt: dateLimit }
        }
      });
      const pRate = sCount > 0 ? Math.round((cCount / sCount) * 100) : 0;
      sparklines.participationPercent.push(pRate);

      // Placement Index
      const activeStuds = await prisma.studentProfile.findMany({
        where: {
          codechefProfile: { isNot: null },
          aiAnalysis: { isNot: null },
          createdAt: { lt: dateLimit }
        },
        include: {
          codechefProfile: true,
          aiAnalysis: true
        }
      });
      let readySum = 0;
      activeStuds.forEach((student) => {
        const rating = student.codechefProfile?.currentRating || 0;
        const contestCount = student.codechefProfile?.contestCount || 0;
        const consistencyScore = student.aiAnalysis?.consistencyScore || 0;
        const talentScore = student.aiAnalysis?.talentScore || 0;

        const ratingScore = Math.min(100, Math.max(0, (rating / 2000) * 100));
        const contestScore = contestCount > 0 ? 100 : 0;
        const score = 0.4 * ratingScore + 0.2 * contestScore + 0.2 * consistencyScore + 0.2 * talentScore;
        readySum += score;
      });
      const prIndex = activeStuds.length > 0 ? Math.round(readySum / activeStuds.length) : 0;
      sparklines.placementIndex.push(prIndex);

      // Four Star
      const f4Count = await prisma.codechefProfile.count({
        where: { stars: 4, createdAt: { lt: dateLimit } }
      });
      sparklines.fourStar.push(f4Count);

      // Five Star
      const f5Count = await prisma.codechefProfile.count({
        where: { stars: { gte: 5 }, createdAt: { lt: dateLimit } }
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
      const hrAgg = await prisma.codechefProfile.aggregate({
        _max: { currentRating: true },
        where: { createdAt: { lt: dateLimit } }
      });
      sparklines.highestRating.push(hrAgg._max.currentRating || 0);
    }

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
      },
    });
  } catch (err: any) {
    console.error("Error in stats api:", err);
    return NextResponse.json({ error: "Failed to load stats details" }, { status: 500 });
  }
}
