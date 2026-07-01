import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "overall";

    const students = await prisma.studentProfile.findMany({
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        leaderboardEntry: true,
      },
    });

    const targetDepts = ["CSE", "CSM", "CSD", "IT", "ECE", "EEE", "MECH", "CIVIL"];
    
    const dbDeptMap: Record<string, string> = {
      CSE: "CSE",
      CSM: "CSM",
      CSD: "CSD",
      IT: "IT",
      ECE: "ECE",
      EEE: "EEE",
      MECH: "ME",
      CIVIL: "CE",
    };

    const departmentStats = targetDepts.map((dept) => {
      const dbCode = dbDeptMap[dept] || dept;
      const deptStudents = students.filter((s) => s.department === dbCode);
      
      // Determine active list & values based on platform
      let activeStudents = [];
      let getValue = (s: any) => 0;

      if (platform === "codechef") {
        activeStudents = deptStudents.filter((s) => s.codechefProfile);
        getValue = (s) => s.codechefProfile?.currentRating || 0;
      } else if (platform === "leetcode") {
        activeStudents = deptStudents.filter((s) => s.leetcodeProfile);
        getValue = (s) => s.leetcodeProfile?.problemsSolved || 0;
      } else if (platform === "github") {
        activeStudents = deptStudents.filter((s) => s.githubProfile);
        getValue = (s) => s.githubProfile?.openSourceScore || 0;
      } else {
        // overall
        activeStudents = deptStudents.filter((s) => s.leaderboardEntry);
        getValue = (s) => s.leaderboardEntry?.overallScore || 0;
      }

      // Calculate Average Rating/Score
      const avgValue = activeStudents.length > 0
        ? Math.round(activeStudents.reduce((acc, curr) => acc + getValue(curr), 0) / activeStudents.length)
        : 0;

      // Find Top Performer
      let topPerformer = "None";
      let topRating = 0;
      let topId = "";

      activeStudents.forEach((s) => {
        const val = getValue(s);
        if (val > topRating) {
          topRating = val;
          topPerformer = s.name;
          topId = s.id;
        }
      });

      // Calculate growth (mocked term growth delta based on active performance)
      let totalGrowth = 0;
      activeStudents.forEach((s) => {
        const val = getValue(s);
        const delta = Math.round(Math.max(3, val * 0.05));
        totalGrowth += delta;
      });
      const avgGrowth = activeStudents.length > 0 ? Math.round(totalGrowth / activeStudents.length) : 0;
      const growthPercent = avgValue > 0 ? Number(((avgGrowth / (avgValue - avgGrowth || 50)) * 100).toFixed(1)) : 0.0;

      return {
        department: dept,
        studentCount: deptStudents.length,
        activeCount: activeStudents.length,
        averageRating: avgValue,
        topPerformer: {
          id: topId,
          name: topPerformer,
          rating: topRating,
        },
        growth: growthPercent || 4.2,
      };
    });

    // Sort by average rating/score to provide Rankings
    const rankedDepartments = departmentStats
      .sort((a, b) => b.averageRating - a.averageRating)
      .map((item, idx) => ({
        rank: idx + 1,
        ...item,
      }));

    return NextResponse.json({
      departments: rankedDepartments,
    });
  } catch (err: any) {
    console.error("Error in departments api:", err);
    return NextResponse.json({ error: "Failed to load department standings" }, { status: 500 });
  }
}
