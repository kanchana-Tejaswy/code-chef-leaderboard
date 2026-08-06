import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffReadAccess, requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const access = await requireStaffReadAccess();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const isActiveStr = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } }
      ];
    }

    if (isActiveStr !== null && isActiveStr !== undefined && isActiveStr !== "") {
      where.isActive = isActiveStr === "true";
    }

    // HOD Scoping Rule: HODs can only read within their assigned department
    if (access.role === "HOD") {
      if (!access.departmentId) {
        return NextResponse.json({ success: false, error: "HOD user lacks a department assignment." }, { status: 403 });
      }
      
      // HOD scoping check: filter by department code or department id
      const hodDepartmentCondition = [
        { id: access.departmentId },
        { code: access.departmentId }
      ];
      
      if (where.OR) {
        // If search filters exist, wrap them in AND with the HOD scoping filter
        where.AND = [
          { OR: where.OR },
          { OR: hodDepartmentCondition }
        ];
        delete where.OR;
      } else {
        where.OR = hodDepartmentCondition;
      }
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        orderBy: { code: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.department.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      departments,
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
    console.error("GET Departments Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const { code, name, isActive } = body;

    // Validation
    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ success: false, error: "Department code is required." }, { status: 400 });
    }
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length > 20) {
      return NextResponse.json({ success: false, error: "Department code cannot exceed 20 characters." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Department name is required." }, { status: 400 });
    }

    // Unique code check
    const existing = await prisma.department.findUnique({
      where: { code: normalizedCode }
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Department code already exists." }, { status: 400 });
    }

    const department = await prisma.department.create({
      data: {
        code: normalizedCode,
        name: name.trim(),
        isActive: isActive !== false
      }
    });

    return NextResponse.json({ success: true, department });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("POST Department Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
