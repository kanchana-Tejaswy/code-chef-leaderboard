import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const userAccess = await requireActiveUser();
    const { slug } = await params;

    const contest = await prisma.contest.findUnique({
      where: { slug },
    });

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Scope to HOD department if caller is an HOD
    let HODDepartmentId: string | null = null;
    if (userAccess.role === "HOD") {
      HODDepartmentId = userAccess.departmentId;
      if (!HODDepartmentId) {
        return NextResponse.json({ error: "HOD has no assigned department." }, { status: 403 });
      }
    }

    // Calculate basic summary statistics
    const participations = await prisma.contestParticipation.findMany({
      where: {
        contestId: contest.id,
        ...(HODDepartmentId
          ? {
              studentEnrollment: {
                departmentId: HODDepartmentId,
              },
            }
          : {}),
      },
      select: {
        rank: true,
        ratingChange: true,
      },
    });

    const participantCount = participations.length;
    let highestRank: number | null = null;
    let averageRank: number | null = null;
    let averageRatingChange: number | null = null;

    if (participantCount > 0) {
      const ranks = participations.map((p) => p.rank).filter((r): r is number => r !== null);
      if (ranks.length > 0) {
        highestRank = Math.min(...ranks);
        averageRank = parseFloat((ranks.reduce((sum, r) => sum + r, 0) / ranks.length).toFixed(1));
      }

      const ratingChanges = participations
        .map((p) => p.ratingChange)
        .filter((rc): rc is number => rc !== null);
      if (ratingChanges.length > 0) {
        averageRatingChange = parseFloat(
          (ratingChanges.reduce((sum, rc) => sum + rc, 0) / ratingChanges.length).toFixed(1)
        );
      }
    }

    // Fetch total eligible students count (in database)
    const eligibleWhere: any = {
      profileStatus: "VERIFIED",
      ...(HODDepartmentId
        ? {
            studentEnrollments: {
              some: {
                departmentId: HODDepartmentId,
                isCurrent: true,
              },
            },
          }
        : {}),
    };

    if (contest.platform === "CODECHEF") {
      eligibleWhere.codechefUsername = { not: null };
    } else if (contest.platform === "LEETCODE") {
      eligibleWhere.leetcodeUsername = { not: null };
    } else if (contest.platform === "CODEFORCES") {
      eligibleWhere.codeforcesUsername = { not: null };
    }

    const eligibleCount = await prisma.studentProfile.count({
      where: eligibleWhere,
    });

    const participationPercentage =
      eligibleCount > 0 ? parseFloat(((participantCount / eligibleCount) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      contest,
      stats: {
        participantCount,
        eligibleCount,
        participationPercentage,
        highestRank,
        averageRank,
        averageRatingChange,
      },
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "FORBIDDEN_ROLE" ? 403 : 401 });
    }
    console.error("GET /api/contests/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
