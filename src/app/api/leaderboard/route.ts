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

  try {
    // 1. Build Query Filters
    const whereClause: any = {};

    if (search || departments.length > 0 || years.length > 0) {
      whereClause.student = {};

      if (search) {
        whereClause.student.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { rollNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      if (departments.length > 0) {
        whereClause.student.department = { in: departments };
      }

      if (years.length > 0) {
        whereClause.student.year = { in: years };
      }
    }

    if (stars.length > 0) {
      whereClause.stars = { in: stars };
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
            },
          },
        },
        orderBy: [
          { rank: "asc" },
          { talentScore: "desc" },
        ],
      });

      const exportData = entries.map((e, idx) => ({
        Rank: idx + 1,
        Name: e.student.name,
        "Roll Number": e.student.rollNumber,
        Department: e.student.department,
        Year: `${e.student.year} Year`,
        "CodeChef Username": e.student.codechefUsername || "N/A",
        Rating: e.rating,
        Stars: `${e.stars}★`,
        "Talent Score": e.talentScore,
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
        { wch: 20 }, // Username
        { wch: 8 },  // Rating
        { wch: 8 },  // Stars
        { wch: 12 }, // Talent Score
      ];
      worksheet["!cols"] = wscols;

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=ace_codechef_leaderboard_${new Date().toISOString().split("T")[0]}.xlsx`,
        },
      });
    }

    // 3. Paginated & Sorted JSON request
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sortBy") || "rank";
    const sortOrder = (searchParams.get("sortOrder") || "asc").toLowerCase() === "desc" ? "desc" : "asc";

    const validSortFields = ["rank", "rating", "stars", "talentScore"];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "rank";

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
              profilePictureUrl: true,
              codechefProfile: {
                select: {
                  currentRating: true,
                  highestRating: true,
                  contests: true,
                  contestCount: true,
                },
              },
            },
          },
        },
        orderBy: [
          { [finalSortBy]: sortOrder },
          { rank: "asc" }, // secondary tie-breaker
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
    });
  } catch (err: any) {
    console.error("Error fetching leaderboard API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
