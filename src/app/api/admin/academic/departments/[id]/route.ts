import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffReadAccess, requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireStaffReadAccess();
    const resolvedParams = await params;
    const department = await prisma.department.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!department) {
      return NextResponse.json({ success: false, error: "Department not found." }, { status: 404 });
    }

    // HOD Scoping check
    if (access.role === "HOD") {
      if (department.id !== access.departmentId && department.code !== access.departmentId) {
        return NextResponse.json({ success: false, error: "Access denied to other departments." }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, department });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("GET Department Detail Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const body = await request.json().catch(() => ({}));
    const { code, name, isActive } = body;

    const departmentId = resolvedParams.id;
    const currentDept = await prisma.department.findUnique({
      where: { id: departmentId }
    });

    if (!currentDept) {
      return NextResponse.json({ success: false, error: "Department not found." }, { status: 404 });
    }

    const dataToUpdate: any = {};

    if (code !== undefined) {
      if (!code || typeof code !== "string" || !code.trim()) {
        return NextResponse.json({ success: false, error: "Department code is required." }, { status: 400 });
      }
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode.length > 20) {
        return NextResponse.json({ success: false, error: "Department code cannot exceed 20 characters." }, { status: 400 });
      }

      if (normalizedCode !== currentDept.code) {
        const existing = await prisma.department.findUnique({
          where: { code: normalizedCode }
        });
        if (existing) {
          return NextResponse.json({ success: false, error: "Department code already exists." }, { status: 400 });
        }
      }
      dataToUpdate.code = normalizedCode;
    }

    if (name !== undefined) {
      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ success: false, error: "Department name is required." }, { status: 400 });
      }
      dataToUpdate.name = name.trim();
    }

    if (isActive !== undefined) {
      dataToUpdate.isActive = !!isActive;
    }

    const department = await prisma.department.update({
      where: { id: departmentId },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true, department });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("PATCH Department Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
