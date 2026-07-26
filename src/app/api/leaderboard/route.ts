export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { OverallScoreService } from "@/services/overallScore.service";
import { prisma } from "@/lib/prisma";
import { requireLeaderboardAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("viewMode") || searchParams.get("mode") || "ranked"; // "ranked" | "all"
  const search = searchParams.get("search") || "";
  const departments = searchParams.get("departments")?.split(",").filter(Boolean) || [];
  const years = searchParams.get("years")?.split(",").map(Number).filter((y) => !isNaN(y)) || [];
  const profileStatusFilter = searchParams.get("profileStatus") || "";
  
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
  const skip = (page - 1) * limit;

  try {
    await requireLeaderboardAccess();

    if (mode === "all") {
      // Query ALL StudentProfile records
      const studentWhere: any = {};

      if (search) {
        studentWhere.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { rollNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      if (departments.length > 0) {
        studentWhere.department = { in: departments };
      }

      if (years.length > 0) {
        studentWhere.year = { in: years };
      }

      if (profileStatusFilter) {
        studentWhere.profileStatus = profileStatusFilter;
      }

      const [students, total] = await Promise.all([
        prisma.studentProfile.findMany({
          where: studentWhere,
          select: {
            id: true,
            name: true,
            rollNumber: true,
            department: true,
            year: true,
            branch: true,
            codechefUsername: true,
            leetcodeUsername: true,
            profileStatus: true,
            verificationStatus: true,
            leaderboardEligible: true,
            dashboardEligible: true,
            adminApprovalStatus: true,
            createdAt: true,
            codechefProfile: {
              select: {
                username: true,
                currentRating: true,
                stars: true,
                problemsSolved: true,
              },
            },
            leetcodeProfile: {
              select: {
                username: true,
                problemsSolved: true,
                contestRating: true,
              },
            },
            leaderboardEntry: {
              select: {
                rank: true,
                overallScore: true,
                codechefScore: true,
                leetcodeScore: true,
                trendDirection: true,
              },
            },
          },
          orderBy: [{ createdAt: "asc" }],
          skip,
          take: limit,
        }),
        prisma.studentProfile.count({ where: studentWhere }),
      ]);

      const formattedStudents = students.map((s) => {
        const hasCcHandle = Boolean(s.codechefUsername && s.codechefUsername.trim() !== "");
        const hasLcHandle = Boolean(s.leetcodeUsername && s.leetcodeUsername.trim() !== "");
        const isCcVerified = Boolean(s.codechefProfile);
        const isLcVerified = Boolean(s.leetcodeProfile);
        const isFullyVerified = s.profileStatus === "VERIFIED" && s.adminApprovalStatus === "APPROVED" && s.leaderboardEligible && isCcVerified && isLcVerified;

        let codechefStatus = "Missing";
        if (hasCcHandle) {
          codechefStatus = isCcVerified ? "Verified" : (s.profileStatus === "INVALID" ? "Failed" : "Pending");
        }

        let leetcodeStatus = "Missing";
        if (hasLcHandle) {
          leetcodeStatus = isLcVerified ? "Verified" : (s.profileStatus === "INVALID" ? "Failed" : "Pending");
        }

        return {
          id: s.id,
          name: s.name,
          rollNumber: s.rollNumber,
          department: s.department || s.branch || "N/A",
          year: s.year,
          codechefUsername: s.codechefUsername,
          leetcodeUsername: s.leetcodeUsername,
          profileStatus: s.profileStatus,
          verificationStatus: s.verificationStatus,
          leaderboardEligible: s.leaderboardEligible,
          codechefStatus,
          leetcodeStatus,
          // Only show rank and scores if student is verified and approved AND rank > 0!
          rank: (isFullyVerified && s.leaderboardEntry?.rank && s.leaderboardEntry.rank > 0) ? s.leaderboardEntry.rank : "—",
          overallScore: isFullyVerified ? (s.leaderboardEntry?.overallScore || 0) : null,
          codechefScore: isFullyVerified ? (s.leaderboardEntry?.codechefScore || 0) : null,
          leetcodeScore: isFullyVerified ? (s.leaderboardEntry?.leetcodeScore || 0) : null,
          trendDirection: isFullyVerified ? (s.leaderboardEntry?.trendDirection || "NEUTRAL") : "NEUTRAL",
          adminApprovalStatus: s.adminApprovalStatus,
          statusText: s.profileStatus === "VERIFIED" && s.adminApprovalStatus !== "APPROVED"
            ? "Awaiting Approval"
            : s.profileStatus === "PENDING_VERIFICATION"
            ? "Verification Pending"
            : s.profileStatus === "INCOMPLETE"
            ? "Incomplete"
            : s.profileStatus === "INVALID"
            ? "Failed"
            : "Verified"
        };
      });

      return NextResponse.json(
        {
          mode: "all",
          students: formattedStudents,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // RANKED MODE (Default): Returns strictly verified competitive leaderboard entries
    const whereClause: any = {
      student: {
        leaderboardEligible: true,
        profileStatus: "VERIFIED",
        adminApprovalStatus: "APPROVED",
      },
    };

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

    const sortBy = searchParams.get("sortBy") || "overallScore";
    const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const validSortFields = ["rank", "rating", "stars", "talentScore", "overallScore", "codechefScore", "leetcodeScore"];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "overallScore";

    const [entries, total] = await Promise.all([
      prisma.leaderboardEntry.findMany({
        where: whereClause,
        select: {
          id: true,
          rank: true,
          rating: true,
          stars: true,
          talentScore: true,
          overallScore: true,
          codechefScore: true,
          leetcodeScore: true,
          trendDirection: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              department: true,
              year: true,
              codechefUsername: true,
              leetcodeUsername: true,
              profilePictureUrl: true,
              verificationStatus: true,
              profileStatus: true,
              leaderboardEligible: true,
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
      prisma.leaderboardEntry.count({ where: whereClause }),
    ]);

    return NextResponse.json(
      {
        mode: "ranked",
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
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
