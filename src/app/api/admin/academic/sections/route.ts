import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffReadAccess, requireAdmin } from "@/lib/auth";
import { CohortStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const access = await requireStaffReadAccess();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const cohortId = searchParams.get("cohortId") || "";
    const departmentId = searchParams.get("departmentId") || "";
    const isActiveStr = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { cohort: { code: { contains: search, mode: "insensitive" } } },
        { department: { code: { contains: search, mode: "insensitive" } } },
        { department: { name: { contains: search, mode: "insensitive" } } }
      ];
    }

    if (cohortId) {
      where.cohortId = cohortId;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (isActiveStr !== null && isActiveStr !== undefined && isActiveStr !== "") {
      where.isActive = isActiveStr === "true";
    }

    // HOD Scoping Rule
    if (access.role === "HOD") {
      if (!access.departmentId) {
        return NextResponse.json({ success: false, error: "HOD user lacks a department assignment." }, { status: 403 });
      }
      
      const hodDept = await prisma.department.findFirst({
        where: {
          OR: [
            { id: access.departmentId },
            { code: access.departmentId }
          ]
        }
      });

      if (!hodDept) {
        return NextResponse.json({ success: false, error: "HOD department record not found." }, { status: 403 });
      }

      where.departmentId = hodDept.id;
    }

    const [sections, total] = await Promise.all([
      prisma.classSection.findMany({
        where,
        include: {
          cohort: true,
          department: true
        },
        orderBy: [
          { cohort: { startYear: "desc" } },
          { department: { code: "asc" } },
          { name: "asc" }
        ],
        skip: offset,
        take: limit,
      }),
      prisma.classSection.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      sections,
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
    console.error("GET ClassSections Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const { cohortId, departmentId, name, capacity, isActive } = body;

    // Basic Validation
    if (!cohortId || typeof cohortId !== "string") {
      return NextResponse.json({ success: false, error: "Cohort reference is required." }, { status: 400 });
    }
    if (!departmentId || typeof departmentId !== "string") {
      return NextResponse.json({ success: false, error: "Department reference is required." }, { status: 400 });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Section name is required." }, { status: 400 });
    }
    const sectionName = name.trim();
    if (sectionName.length > 50) {
      return NextResponse.json({ success: false, error: "Section name cannot exceed 50 characters." }, { status: 400 });
    }

    let parsedCapacity: number | null = null;
    if (capacity !== undefined && capacity !== null && capacity !== "") {
      parsedCapacity = parseInt(capacity, 10);
      if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
        return NextResponse.json({ success: false, error: "Capacity must be a positive integer." }, { status: 400 });
      }
    }

    // 1. Verify Cohort exists and is not archived
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId }
    });
    if (!cohort) {
      return NextResponse.json({ success: false, error: "Cohort not found." }, { status: 400 });
    }
    if (cohort.status === CohortStatus.ARCHIVED) {
      return NextResponse.json({ success: false, error: "Cannot create sections under an archived cohort." }, { status: 400 });
    }

    // 2. Verify Department exists and is active
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });
    if (!department) {
      return NextResponse.json({ success: false, error: "Department not found." }, { status: 400 });
    }
    if (!department.isActive) {
      return NextResponse.json({ success: false, error: "Cannot create sections under an inactive/archived department." }, { status: 400 });
    }

    // 3. Unique combo check
    const existing = await prisma.classSection.findUnique({
      where: {
        cohortId_departmentId_name: {
          cohortId,
          departmentId,
          name: sectionName
        }
      }
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "A class section with this name already exists in this cohort and department." }, { status: 400 });
    }

    const section = await prisma.classSection.create({
      data: {
        cohortId,
        departmentId,
        name: sectionName,
        capacity: parsedCapacity,
        isActive: isActive !== false
      },
      include: {
        cohort: true,
        department: true
      }
    });

    return NextResponse.json({ success: true, section });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("POST ClassSection Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
