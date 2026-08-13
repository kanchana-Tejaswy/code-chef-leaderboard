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

    // Load all participations for in-memory aggregation
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
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
          },
        },
        studentEnrollment: {
          include: {
            cohort: true,
            department: true,
            classSection: true,
          },
        },
      },
    });

    const participantCount = participations.length;

    // Get total eligible students count
    const totalEligible = await prisma.studentProfile.count({
      where: {
        codechefUsername: { not: null },
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
      },
    });

    const participationPercentage =
      totalEligible > 0 ? parseFloat(((participantCount / totalEligible) * 100).toFixed(1)) : 0;

    let highestRank: number | null = null;
    let averageRank: number | null = null;
    let averageRatingChange: number | null = null;

    const departmentCounts: Record<string, number> = {};
    const cohortCounts: Record<string, number> = {};
    const sectionCounts: Record<string, number> = {};

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

      // Compute breakdowns
      participations.forEach((p) => {
        const enrollment = p.studentEnrollment;
        if (enrollment) {
          const dept = enrollment.department?.code || "Unknown";
          const cohort = enrollment.cohort?.code || "Unknown";
          const section = enrollment.classSection?.name || "Unknown";

          departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
          cohortCounts[cohort] = (cohortCounts[cohort] || 0) + 1;
          sectionCounts[section] = (sectionCounts[section] || 0) + 1;
        }
      });
    }

    // Top performers (sorted by rank asc, non-null ranks first)
    const topPerformers = participations
      .filter((p) => p.rank !== null)
      .sort((a, b) => (a.rank as number) - (b.rank as number))
      .slice(0, 5)
      .map((p) => ({
        studentId: p.studentId,
        name: p.student.name,
        rollNumber: p.student.rollNumber,
        rank: p.rank,
        ratingAfter: p.ratingAfter,
        ratingChange: p.ratingChange,
        department: p.studentEnrollment?.department?.code || null,
        cohort: p.studentEnrollment?.cohort?.code || null,
        section: p.studentEnrollment?.classSection?.name || null,
      }));

    return NextResponse.json({
      success: true,
      stats: {
        totalEligible,
        participantCount,
        participationPercentage,
        highestRank,
        averageRank,
        averageRatingChange,
      },
      breakdowns: {
        department: departmentCounts,
        cohort: cohortCounts,
        section: sectionCounts,
      },
      topPerformers,
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "FORBIDDEN_ROLE" ? 403 : 401 });
    }
    console.error("GET /api/contests/[slug]/stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
