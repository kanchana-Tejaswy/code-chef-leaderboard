import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const departments = searchParams.get("departments")?.split(",").filter(Boolean) || [];
  const years = searchParams.get("years")?.split(",").map(Number).filter((y) => !isNaN(y)) || [];
  const stars = searchParams.get("stars")?.split(",").map(Number).filter((s) => !isNaN(s)) || [];
  const doExport = searchParams.get("export") === "true";

  // CodeChef filters
  const ccRatingMin = searchParams.get("ccRatingMin") ? Number(searchParams.get("ccRatingMin")) : null;
  const ccRatingMax = searchParams.get("ccRatingMax") ? Number(searchParams.get("ccRatingMax")) : null;
  const ccContestsMin = searchParams.get("ccContestsMin") ? Number(searchParams.get("ccContestsMin")) : null;

  // LeetCode filters
  const lcRatingMin = searchParams.get("lcRatingMin") ? Number(searchParams.get("lcRatingMin")) : null;
  const lcRatingMax = searchParams.get("lcRatingMax") ? Number(searchParams.get("lcRatingMax")) : null;
  const lcEasyMin = searchParams.get("lcEasyMin") ? Number(searchParams.get("lcEasyMin")) : null;
  const lcMediumMin = searchParams.get("lcMediumMin") ? Number(searchParams.get("lcMediumMin")) : null;
  const lcHardMin = searchParams.get("lcHardMin") ? Number(searchParams.get("lcHardMin")) : null;

  // GitHub filters
  const ghFollowersMin = searchParams.get("ghFollowersMin") ? Number(searchParams.get("ghFollowersMin")) : null;
  const ghStarsMin = searchParams.get("ghStarsMin") ? Number(searchParams.get("ghStarsMin")) : null;
  const ghReposMin = searchParams.get("ghReposMin") ? Number(searchParams.get("ghReposMin")) : null;

  try {
    // 1. Build Query Filters
    const whereClause: any = {};

    if (search || departments.length > 0 || years.length > 0 ||
        ccRatingMin !== null || ccRatingMax !== null || ccContestsMin !== null ||
        lcRatingMin !== null || lcRatingMax !== null || lcEasyMin !== null || lcMediumMin !== null || lcHardMin !== null ||
        ghFollowersMin !== null || ghStarsMin !== null || ghReposMin !== null) {
      
      whereClause.student = {};

      if (search) {
        whereClause.student.OR = [
          { name: { contains: search } },
          { rollNumber: { contains: search } },
        ];
      }

      if (departments.length > 0) {
        whereClause.student.department = { in: departments };
      }

      if (years.length > 0) {
        whereClause.student.year = { in: years };
      }

      // CodeChef relation filters
      if (ccRatingMin !== null || ccRatingMax !== null || ccContestsMin !== null) {
        whereClause.student.codechefProfile = {};
        if (ccRatingMin !== null) {
          whereClause.student.codechefProfile.currentRating = { gte: ccRatingMin };
        }
        if (ccRatingMax !== null) {
          whereClause.student.codechefProfile.currentRating = {
            ...whereClause.student.codechefProfile.currentRating,
            lte: ccRatingMax,
          };
        }
        if (ccContestsMin !== null) {
          whereClause.student.codechefProfile.contestCount = { gte: ccContestsMin };
        }
      }

      // LeetCode relation filters
      if (lcRatingMin !== null || lcRatingMax !== null || lcEasyMin !== null || lcMediumMin !== null || lcHardMin !== null) {
        whereClause.student.leetcodeProfile = {};
        if (lcRatingMin !== null) {
          whereClause.student.leetcodeProfile.contestRating = { gte: lcRatingMin };
        }
        if (lcRatingMax !== null) {
          whereClause.student.leetcodeProfile.contestRating = {
            ...whereClause.student.leetcodeProfile.contestRating,
            lte: lcRatingMax,
          };
        }
        if (lcEasyMin !== null) {
          whereClause.student.leetcodeProfile.easySolvedCount = { gte: lcEasyMin };
        }
        if (lcMediumMin !== null) {
          whereClause.student.leetcodeProfile.mediumSolvedCount = { gte: lcMediumMin };
        }
        if (lcHardMin !== null) {
          whereClause.student.leetcodeProfile.hardSolvedCount = { gte: lcHardMin };
        }
      }

      // GitHub relation filters
      if (ghFollowersMin !== null || ghStarsMin !== null || ghReposMin !== null) {
        whereClause.student.githubProfile = {};
        if (ghFollowersMin !== null) {
          whereClause.student.githubProfile.followers = { gte: ghFollowersMin };
        }
        if (ghStarsMin !== null) {
          whereClause.student.githubProfile.totalStars = { gte: ghStarsMin };
        }
        if (ghReposMin !== null) {
          whereClause.student.githubProfile.totalRepositories = { gte: ghReposMin };
        }
      }
    }

    if (stars.length > 0) {
      whereClause.stars = { in: stars };
    }

    // Sorting parameters
    const sortBy = searchParams.get("sortBy") || "overallScore";
    const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const validSortFields = [
      "rank", "rating", "stars", "talentScore", "overallScore", "codechefScore", "leetcodeScore", "githubScore",
      "ccRating", "ccHighestRating", "ccContests", "lcRating", "lcSolved", "lcConsistency", "lcRank", "ghActivity", "ghRepos", "consistency"
    ];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "overallScore";

    let orderByArray: any[] = [];
    if (finalSortBy === "ccRating") {
      orderByArray = [
        { student: { codechefProfile: { currentRating: sortOrder } } },
        { student: { codechefProfile: { highestRating: sortOrder } } },
        { student: { codechefProfile: { globalRank: "asc" } } }
      ];
    } else if (finalSortBy === "ccHighestRating") {
      orderByArray = [
        { student: { codechefProfile: { highestRating: sortOrder } } },
        { student: { codechefProfile: { globalRank: "asc" } } }
      ];
    } else if (finalSortBy === "lcRank") {
      // Best global rank (lowest number) first by default (asc)
      orderByArray = [
        { student: { leetcodeProfile: { contestRank: sortOrder } } }
      ];
    } else if (finalSortBy === "ghActivity") {
      orderByArray = [
        { student: { githubProfile: { openSourceScore: sortOrder } } },
        { student: { githubProfile: { followers: sortOrder } } },
        { student: { githubProfile: { totalStars: sortOrder } } },
        { student: { githubProfile: { totalRepositories: sortOrder } } }
      ];
    } else {
      let orderClause: any = {};
      if (finalSortBy === "ccContests") {
        orderClause = { student: { codechefProfile: { contestCount: sortOrder } } };
      } else if (finalSortBy === "lcRating") {
        orderClause = { student: { leetcodeProfile: { contestRating: sortOrder } } };
      } else if (finalSortBy === "lcSolved") {
        orderClause = { student: { leetcodeProfile: { problemsSolved: sortOrder } } };
      } else if (finalSortBy === "lcConsistency") {
        orderClause = { student: { leetcodeProfile: { consistencyScore: sortOrder } } };
      } else if (finalSortBy === "ghRepos") {
        orderClause = { student: { githubProfile: { totalRepositories: sortOrder } } };
      } else if (finalSortBy === "consistency") {
        orderClause = { student: { normalizedProfile: { consistencyScore: sortOrder } } };
      } else {
        orderClause = { [finalSortBy]: sortOrder };
      }
      orderByArray = [orderClause, { rank: "asc" }];
    }

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
        orderBy: orderByArray,
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
        "GitHub Score": e.githubScore,
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
        },
      });
    }

    // 3. Paginated & Sorted JSON request
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const skip = (page - 1) * limit;

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
              verificationStatus: true,
              codechefProfile: true,
              leetcodeProfile: true,
              githubProfile: true,
              aiAnalysis: true,
            },
          },
        },
        orderBy: orderByArray,
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
    });
  } catch (err: any) {
    console.error("Error fetching leaderboard cache API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
