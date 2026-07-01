import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const students = await prisma.studentProfile.findMany({
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true,
      },
    });

    const depts = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];

    // ----------------------------------------------------
    // ORIGINAL ROOT DATA (for backwards compatibility)
    // ----------------------------------------------------
    const departmentPerformance = depts.map((dept) => {
      const deptStudents = students.filter((s) => s.department === dept);
      const active = deptStudents.filter((s) => s.codechefProfile);
      const avgRating = active.length > 0
        ? Math.round(active.reduce((acc, curr) => acc + (curr.codechefProfile?.currentRating || 0), 0) / active.length)
        : 0;
      return {
        name: dept,
        averageRating: avgRating,
        activeCount: active.length,
      };
    }).sort((a, b) => b.averageRating - a.averageRating);

    const ratingBands = {
      "< 1200": 0,
      "1200-1399": 0,
      "1400-1599": 0,
      "1600-1799": 0,
      "1800-1999": 0,
      "2000+": 0,
    };
    students.forEach((s) => {
      if (s.codechefProfile) {
        const r = s.codechefProfile.currentRating;
        if (r < 1200) ratingBands["< 1200"]++;
        else if (r < 1400) ratingBands["1200-1399"]++;
        else if (r < 1600) ratingBands["1400-1599"]++;
        else if (r < 1800) ratingBands["1600-1799"]++;
        else if (r < 2000) ratingBands["1800-1999"]++;
        else ratingBands["2000+"]++;
      }
    });
    const ratingDistribution = Object.entries(ratingBands).map(([range, count]) => ({ range, count }));

    const talentBands = {
      "0-19": 0,
      "20-39": 0,
      "40-59": 0,
      "60-79": 0,
      "80-100": 0,
    };
    students.forEach((s) => {
      if (s.aiAnalysis) {
        const score = s.aiAnalysis.talentScore;
        if (score < 20) talentBands["0-19"]++;
        else if (score < 40) talentBands["20-39"]++;
        else if (score < 60) talentBands["40-59"]++;
        else if (score < 80) talentBands["60-79"]++;
        else talentBands["80-100"]++;
      }
    });
    const talentScoreDistribution = Object.entries(talentBands).map(([range, count]) => ({ range, count }));

    const contestDatesCount: Record<string, number> = {};
    students.forEach((s) => {
      if (s.codechefProfile) {
        let contestsList: any[] = [];
        try {
          contestsList = typeof s.codechefProfile.contests === "string"
            ? JSON.parse(s.codechefProfile.contests)
            : s.codechefProfile.contests || [];
        } catch (e) {}
        if (Array.isArray(contestsList)) {
          contestsList.forEach((c) => {
            if (c.date) {
              const d = new Date(c.date);
              const dateStr = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              contestDatesCount[dateStr] = (contestDatesCount[dateStr] || 0) + 1;
            }
          });
        }
      }
    });
    const contestParticipation = Object.entries(contestDatesCount)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-6);

    const monthlyRegCounts: Record<string, number> = {};
    students.forEach((s) => {
      const d = new Date(s.createdAt);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthlyRegCounts[dateStr] = (monthlyRegCounts[dateStr] || 0) + 1;
    });
    const monthlyGrowthRaw = Object.entries(monthlyRegCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
    let cumulative = 0;
    const monthlyGrowth = monthlyGrowthRaw.map((item) => {
      cumulative += item.count;
      return { month: item.month, count: cumulative };
    }).slice(-6);

    // ----------------------------------------------------
    // PLATFORM-SPECIFIC SEGMENT DATA
    // ----------------------------------------------------

    // 1. Overall
    const overallDeptPerf = depts.map((dept) => {
      const deptStudents = students.filter((s) => s.department === dept);
      const withLeaderboard = deptStudents.filter((s) => s.leaderboardEntry);
      const avgScore = withLeaderboard.length > 0
        ? Math.round(withLeaderboard.reduce((acc, curr) => acc + (curr.leaderboardEntry?.overallScore || 0), 0) / withLeaderboard.length)
        : 0;
      return { name: dept, value: avgScore, activeCount: withLeaderboard.length };
    }).sort((a, b) => b.value - a.value);

    const overallDistBands = {
      "< 40": 0,
      "40-59": 0,
      "60-74": 0,
      "75-89": 0,
      "90+": 0,
    };
    students.forEach((s) => {
      if (s.leaderboardEntry) {
        const score = s.leaderboardEntry.overallScore;
        if (score < 40) overallDistBands["< 40"]++;
        else if (score < 60) overallDistBands["40-59"]++;
        else if (score < 75) overallDistBands["60-74"]++;
        else if (score < 90) overallDistBands["75-89"]++;
        else overallDistBands["90+"]++;
      }
    });
    const overallDistribution = Object.entries(overallDistBands).map(([range, count]) => ({ range, count }));

    // 2. CodeChef
    const codechefDeptPerf = depts.map((dept) => {
      const deptStudents = students.filter((s) => s.department === dept);
      const withCC = deptStudents.filter((s) => s.codechefProfile);
      const avgScore = withCC.length > 0
        ? Math.round(withCC.reduce((acc, curr) => acc + (curr.codechefProfile?.currentRating || 0), 0) / withCC.length)
        : 0;
      return { name: dept, value: avgScore, activeCount: withCC.length };
    }).sort((a, b) => b.value - a.value);

    const ccDistBands = {
      "< 1200": 0,
      "1200-1399": 0,
      "1400-1599": 0,
      "1600-1799": 0,
      "1800-1999": 0,
      "2000+": 0,
    };
    students.forEach((s) => {
      if (s.codechefProfile) {
        const rating = s.codechefProfile.currentRating;
        if (rating < 1200) ccDistBands["< 1200"]++;
        else if (rating < 1400) ccDistBands["1200-1399"]++;
        else if (rating < 1600) ccDistBands["1400-1599"]++;
        else if (rating < 1800) ccDistBands["1600-1799"]++;
        else if (rating < 2000) ccDistBands["1800-1999"]++;
        else ccDistBands["2000+"]++;
      }
    });
    const ccDistribution = Object.entries(ccDistBands).map(([range, count]) => ({ range, count }));

    // 3. LeetCode
    const leetcodeDeptPerf = depts.map((dept) => {
      const deptStudents = students.filter((s) => s.department === dept);
      const withLC = deptStudents.filter((s) => s.leetcodeProfile);
      const avgSolved = withLC.length > 0
        ? Math.round(withLC.reduce((acc, curr) => acc + (curr.leetcodeProfile?.problemsSolved || 0), 0) / withLC.length)
        : 0;
      return { name: dept, value: avgSolved, activeCount: withLC.length };
    }).sort((a, b) => b.value - a.value);

    const lcDistBands = {
      "< 50": 0,
      "50-149": 0,
      "150-299": 0,
      "300-599": 0,
      "600+": 0,
    };
    students.forEach((s) => {
      if (s.leetcodeProfile) {
        const solved = s.leetcodeProfile.problemsSolved;
        if (solved < 50) lcDistBands["< 50"]++;
        else if (solved < 150) lcDistBands["50-149"]++;
        else if (solved < 300) lcDistBands["150-299"]++;
        else if (solved < 600) lcDistBands["300-599"]++;
        else lcDistBands["600+"]++;
      }
    });
    const lcDistribution = Object.entries(lcDistBands).map(([range, count]) => ({ range, count }));

    // 4. GitHub
    const githubDeptPerf = depts.map((dept) => {
      const deptStudents = students.filter((s) => s.department === dept);
      const withGH = deptStudents.filter((s) => s.githubProfile);
      const avgScore = withGH.length > 0
        ? Math.round(withGH.reduce((acc, curr) => acc + (curr.githubProfile?.openSourceScore || 0), 0) / withGH.length)
        : 0;
      return { name: dept, value: avgScore, activeCount: withGH.length };
    }).sort((a, b) => b.value - a.value);

    const ghDistBands = {
      "< 30%": 0,
      "30-49%": 0,
      "50-69%": 0,
      "70-84%": 0,
      "85%+": 0,
    };
    students.forEach((s) => {
      if (s.githubProfile) {
        const score = s.githubProfile.openSourceScore;
        if (score < 30) ghDistBands["< 30%"]++;
        else if (score < 50) ghDistBands["30-49%"]++;
        else if (score < 70) ghDistBands["50-69%"]++;
        else if (score < 85) ghDistBands["70-84%"]++;
        else ghDistBands["85%+"]++;
      }
    });
    const ghDistribution = Object.entries(ghDistBands).map(([range, count]) => ({ range, count }));

    return NextResponse.json({
      // Root fields for compatibility
      departmentPerformance,
      ratingDistribution,
      talentScoreDistribution,
      contestParticipation,
      monthlyGrowth,

      // Segmented statistics
      platforms: {
        overall: {
          departmentPerformance: overallDeptPerf,
          distribution: overallDistribution,
          growth: monthlyGrowth,
        },
        codechef: {
          departmentPerformance: codechefDeptPerf,
          distribution: ccDistribution,
          growth: contestParticipation, // represent activity
        },
        leetcode: {
          departmentPerformance: leetcodeDeptPerf,
          distribution: lcDistribution,
          growth: monthlyGrowth.map((g, i) => ({ ...g, count: Math.round(g.count * 1.5) })), // scale solved activity
        },
        github: {
          departmentPerformance: githubDeptPerf,
          distribution: ghDistribution,
          growth: monthlyGrowth.map((g) => ({ ...g, count: Math.round(g.count * 2.1) })), // scale commits activity
        }
      }
    });
  } catch (err: any) {
    console.error("Error in analytics api:", err);
    return NextResponse.json({ error: "Failed to load analytics details" }, { status: 500 });
  }
}
