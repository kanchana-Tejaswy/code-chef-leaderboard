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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search") || "";
    const department = searchParams.get("department");
    const cohort = searchParams.get("cohort");
    const section = searchParams.get("section");
    const sort = searchParams.get("sort") || "rank";
    const order = (searchParams.get("order") || "asc") as "asc" | "desc";

    // Scope to HOD department if caller is an HOD
    let HODDepartmentId: string | null = null;
    if (userAccess.role === "HOD") {
      HODDepartmentId = userAccess.departmentId;
      if (!HODDepartmentId) {
        return NextResponse.json({ error: "HOD has no assigned department." }, { status: 403 });
      }
    }

    // Build query where clause
    const where: any = {
      contestId: contest.id,
    };

    if (search) {
      where.OR = [
        { student: { name: { contains: search, mode: "insensitive" } } },
        { student: { rollNumber: { contains: search, mode: "insensitive" } } },
        { platformUsername: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build enrollment filters
    const enrollmentFilter: any = {};

    if (HODDepartmentId) {
      enrollmentFilter.departmentId = HODDepartmentId;
    } else if (department) {
      enrollmentFilter.OR = [
        { departmentId: department },
        { department: { code: department } },
      ];
    }

    if (cohort) {
      const cohortConditions = [
        { cohortId: cohort },
        { cohort: { code: cohort } },
      ];
      if (enrollmentFilter.OR) {
        enrollmentFilter.AND = enrollmentFilter.AND || [];
        enrollmentFilter.AND.push({ OR: cohortConditions });
      } else {
        enrollmentFilter.OR = cohortConditions;
      }
    }

    if (section) {
      const sectionConditions = [
        { classSectionId: section },
        { classSection: { name: section } },
      ];
      if (enrollmentFilter.AND) {
        enrollmentFilter.AND.push({ OR: sectionConditions });
      } else if (enrollmentFilter.OR) {
        enrollmentFilter.AND = [{ OR: enrollmentFilter.OR }, { OR: sectionConditions }];
        delete enrollmentFilter.OR;
      } else {
        enrollmentFilter.OR = sectionConditions;
      }
    }

    if (Object.keys(enrollmentFilter).length > 0) {
      where.studentEnrollment = enrollmentFilter;
    }

    // Determine sorting
    let orderBy: any = { rank: "asc" };
    if (sort === "score") {
      orderBy = { score: order };
    } else if (sort === "rank") {
      orderBy = { rank: order };
    } else if (sort === "ratingChange") {
      orderBy = { ratingChange: order };
    } else if (sort === "name") {
      orderBy = { student: { name: order } };
    } else if (sort === "rollNumber") {
      orderBy = { student: { rollNumber: order } };
    }

    const total = await prisma.contestParticipation.count({ where });
    const data = await prisma.contestParticipation.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
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

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "FORBIDDEN_ROLE" ? 403 : 401 });
    }
    console.error("GET /api/contests/[slug]/participants error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
