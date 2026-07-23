export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { OverallScoreService } from "@/services/overallScore.service";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";


import { requireLeaderboardAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  let departments = searchParams.get("departments")?.split(",").filter(Boolean) || [];
  const years = searchParams.get("years")?.split(",").map(Number).filter((y) => !isNaN(y)) || [];
  const stars = searchParams.get("stars")?.split(",").map(Number).filter((s) => !isNaN(s)) || [];
  const doExport = searchParams.get("export") === "true";

  try {
    await requireLeaderboardAccess();

    // 1. Build Query Filters
    const whereClause: any = {
      student: {
        leaderboardEligible: true,
      },
    };

    if (search || departments.length > 0 || years.length > 0) {
      whereClause.student = {
        leaderboardEligible: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { rollNumber: { contains: search } },
              ],
            }
          : {}),
        ...(departments.length > 0 ? { department: { in: departments } } : {}),
        ...(years.length > 0 ? { year: { in: years } } : {}),
      };
    }

    if (stars.length > 0) {
      whereClause.stars = { in: stars };
    }

    // 2. Handle Excel Export Request (Bypasses Pagination)
    // 2. Handle Excel Export Request (Bypasses Pagination)
    if (doExport) {
      const entries = await prisma.leaderboardEntry.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              name: true,
              rollNumber: true,
              department: true,
              year: true,
              codechefUsername: true,
              leetcodeUsername: true,
              githubUsername: true,
            },
          },
        },
        orderBy: [
          { rank: "asc" },
          { overallScore: "desc" },
        ],
      });

      const exportData = entries.map((e, idx) => ({
        Rank: idx + 1,
        Name: e.student.name,
        "Roll Number": e.student.rollNumber,
        Department: e.student.department,
        Year: `${e.student.year} Year`,
        "CodeChef Username": e.student.codechefUsername || "N/A",
        "LeetCode Username": e.student.leetcodeUsername || "N/A",
        "GitHub Username": e.student.githubUsername || "N/A",
        "Overall Score": e.overallScore,
        "CodeChef Score": e.codechefScore,
        "LeetCode Score": e.leetcodeScore,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leaderboard");

      // Set column widths for presentation
      const wscols = [
        { wch: 6 },  // Rank
        { wch: 22 }, // Name
        { wch: 15 }, // Roll Number
        { wch: 12 }, // Department
        { wch: 8 },  // Year
        { wch: 20 }, // CodeChef
        { wch: 20 }, // LeetCode
        { wch: 20 }, // GitHub
        { wch: 12 }, // Overall Score
        { wch: 12 }, // CodeChef Score
        { wch: 12 }, // LeetCode Score
        { wch: 12 }, // GitHub Score
      ];
      worksheet["!cols"] = wscols;

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=ace_developer_leaderboard_${new Date().toISOString().split("T")[0]}.xlsx`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // 3. Paginated & Sorted JSON request
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sortBy") || "overallScore";
    const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const validSortFields = ["rank", "rating", "stars", "talentScore", "overallScore", "codechefScore", "leetcodeScore"];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "overallScore";

    const [entries, total] = await Promise.all([
      prisma.leaderboardEntry.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              department: true,
              year: true,
              codechefUsername: true,
              leetcodeUsername: true,
              githubUsername: true,
              profilePictureUrl: true,
              codechefProfile: {
                select: {
                  currentRating: true,
                  highestRating: true,
                  stars: true,
                  globalRank: true,
                  countryRank: true,
                }
              },
              leetcodeProfile: {
                select: {
                  problemsSolved: true,
                  acceptanceRate: true,
                  contestRank: true,
                }
              },
              githubProfile: {
                select: {
                  totalRepositories: true,
                  totalStars: true,
                  openSourceScore: true,
                }
              },
              aiAnalysis: {
                select: {
                  talentScore: true,
                  consistencyScore: true,
                }
              },
            },
          },
        },
        orderBy: finalSortBy === "overallScore" 
          ? OverallScoreService.getCompetitiveSortOrder(sortOrder as any)
          : [
              { [finalSortBy]: sortOrder },
              ...OverallScoreService.getCompetitiveSortOrder("desc"),
            ],
        skip,
        take: limit,
      }),
      prisma.leaderboardEntry.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    console.error("Error fetching leaderboard API:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
