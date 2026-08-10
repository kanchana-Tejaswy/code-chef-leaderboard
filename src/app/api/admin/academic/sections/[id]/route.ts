import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffReadAccess, requireAdmin } from "@/lib/auth";
import { CohortStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireStaffReadAccess();
    const resolvedParams = await params;
    const section = await prisma.classSection.findUnique({
      where: { id: resolvedParams.id },
      include: { cohort: true, department: true }
    });

    if (!section) {
      return NextResponse.json({ success: false, error: "Class section not found." }, { status: 404 });
    }

    // HOD Scoping check
    if (access.role === "HOD") {
      const hodDept = await prisma.department.findFirst({
        where: {
          OR: [
            { id: access.departmentId || "" },
            { code: access.departmentId || "" }
          ]
        }
      });
      if (!hodDept || section.departmentId !== hodDept.id) {
        return NextResponse.json({ success: false, error: "Access denied to other departments." }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, section });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("GET ClassSection Detail Error:", err);
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
    const { cohortId, departmentId, name, capacity, isActive } = body;

    const sectionId = resolvedParams.id;
    const currentSection = await prisma.classSection.findUnique({
      where: { id: sectionId }
    });

    if (!currentSection) {
      return NextResponse.json({ success: false, error: "Class section not found." }, { status: 404 });
    }

    const dataToUpdate: any = {};

    const resolvedCohortId = cohortId !== undefined ? cohortId : currentSection.cohortId;
    const resolvedDepartmentId = departmentId !== undefined ? departmentId : currentSection.departmentId;
    const resolvedName = name !== undefined ? name.trim() : currentSection.name;

    if (cohortId !== undefined) {
      if (!cohortId || typeof cohortId !== "string") {
        return NextResponse.json({ success: false, error: "Cohort reference is required." }, { status: 400 });
      }
      const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
      if (!cohort) {
        return NextResponse.json({ success: false, error: "Cohort not found." }, { status: 400 });
      }
      if (cohort.status === CohortStatus.ARCHIVED) {
        return NextResponse.json({ success: false, error: "Cannot assign sections to an archived cohort." }, { status: 400 });
      }
      dataToUpdate.cohortId = cohortId;
    }

    if (departmentId !== undefined) {
      if (!departmentId || typeof departmentId !== "string") {
        return NextResponse.json({ success: false, error: "Department reference is required." }, { status: 400 });
      }
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return NextResponse.json({ success: false, error: "Department not found." }, { status: 400 });
      }
      if (!dept.isActive) {
        return NextResponse.json({ success: false, error: "Cannot assign sections to an inactive/archived department." }, { status: 400 });
      }
      dataToUpdate.departmentId = departmentId;
    }

    if (name !== undefined) {
      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ success: false, error: "Section name is required." }, { status: 400 });
      }
      if (resolvedName.length > 50) {
        return NextResponse.json({ success: false, error: "Section name cannot exceed 50 characters." }, { status: 400 });
      }
      dataToUpdate.name = resolvedName;
    }

    if (capacity !== undefined) {
      if (capacity === null || capacity === "") {
        dataToUpdate.capacity = null;
      } else {
        const parsedCapacity = parseInt(capacity, 10);
        if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
          return NextResponse.json({ success: false, error: "Capacity must be a positive integer." }, { status: 400 });
        }
        dataToUpdate.capacity = parsedCapacity;
      }
    }

    if (isActive !== undefined) {
      dataToUpdate.isActive = !!isActive;
    }

    // Check unique combo only if name, cohort, or department changed
    if (
      resolvedCohortId !== currentSection.cohortId ||
      resolvedDepartmentId !== currentSection.departmentId ||
      resolvedName !== currentSection.name
    ) {
      const existing = await prisma.classSection.findUnique({
        where: {
          cohortId_departmentId_name: {
            cohortId: resolvedCohortId,
            departmentId: resolvedDepartmentId,
            name: resolvedName
          }
        }
      });
      if (existing) {
        return NextResponse.json({ success: false, error: "A class section with this name already exists in this cohort and department." }, { status: 400 });
      }
    }

    const section = await prisma.classSection.update({
      where: { id: sectionId },
      data: dataToUpdate,
      include: { cohort: true, department: true }
    });

    return NextResponse.json({ success: true, section });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("PATCH ClassSection Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
