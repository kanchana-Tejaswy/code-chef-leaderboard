import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ContestPlatform, ContestStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const userAccess = await requireActiveUser();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") as ContestPlatform | null;
    const status = searchParams.get("status") as ContestStatus | null;
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

    // Scope to HOD department if caller is an HOD
    let HODDepartmentId: string | null = null;
    if (userAccess.role === "HOD") {
      HODDepartmentId = userAccess.departmentId;
      if (!HODDepartmentId) {
        return NextResponse.json({ error: "HOD has no assigned department." }, { status: 403 });
      }
    }

    // Build Contest search where clause
    const where: any = {};
    if (platform) {
      where.platform = platform;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { platformContestId: { contains: search, mode: "insensitive" } },
      ];
    }

    const total = await prisma.contest.count({ where });
    const contests = await prisma.contest.findMany({
      where,
      orderBy: { startTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Fetch participant counts, optionally scoped to HOD's department
    const participantCounts = await prisma.contestParticipation.groupBy({
      by: ["contestId"],
      where: {
        contestId: { in: contests.map((c) => c.id) },
        ...(HODDepartmentId
          ? {
              studentEnrollment: {
                departmentId: HODDepartmentId,
              },
            }
          : {}),
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map<string, number>();
    participantCounts.forEach((c) => {
      countMap.set(c.contestId, c._count.id);
    });

    const data = contests.map((c) => ({
      ...c,
      participantCount: countMap.get(c.id) || 0,
    }));

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
    console.error("GET /api/contests error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
