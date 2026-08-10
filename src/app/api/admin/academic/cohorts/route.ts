import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffReadAccess, requireAdmin } from "@/lib/auth";
import { CohortStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireStaffReadAccess();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.code = {
        contains: search,
        mode: "insensitive"
      };
    }

    if (status) {
      where.status = status as CohortStatus;
    }

    const [cohorts, total] = await Promise.all([
      prisma.cohort.findMany({
        where,
        orderBy: [{ startYear: "desc" }, { code: "asc" }],
        skip: offset,
        take: limit,
      }),
      prisma.cohort.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      cohorts,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    }, { headers: { "Cache-Control": "private, no-store" } });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("GET Cohorts Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const { code, startYear, endYear, status } = body;

    // Validation
    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ success: false, error: "Cohort code is required." }, { status: 400 });
    }
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length > 20) {
      return NextResponse.json({ success: false, error: "Cohort code cannot exceed 20 characters." }, { status: 400 });
    }

    const start = parseInt(startYear, 10);
    const end = parseInt(endYear, 10);
    if (isNaN(start) || isNaN(end)) {
      return NextResponse.json({ success: false, error: "Start year and End year must be valid integers." }, { status: 400 });
    }
    if (start >= end) {
      return NextResponse.json({ success: false, error: "Start year must be earlier than end year." }, { status: 400 });
    }

    // Unique code check
    const existingCode = await prisma.cohort.findUnique({
      where: { code: normalizedCode }
    });
    if (existingCode) {
      return NextResponse.json({ success: false, error: "Cohort code already exists." }, { status: 400 });
    }

    // Unique combination check
    const existingCombo = await prisma.cohort.findUnique({
      where: { startYear_endYear: { startYear: start, endYear: end } }
    });
    if (existingCombo) {
      return NextResponse.json({ success: false, error: "Cohort combination of start and end years already exists." }, { status: 400 });
    }

    let cohortStatus: CohortStatus = CohortStatus.ACTIVE;
    if (status && Object.values(CohortStatus).includes(status as CohortStatus)) {
      cohortStatus = status as CohortStatus;
    }

    const cohort = await prisma.cohort.create({
      data: {
        code: normalizedCode,
        startYear: start,
        endYear: end,
        status: cohortStatus
      }
    });

    return NextResponse.json({ success: true, cohort });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("POST Cohort Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
