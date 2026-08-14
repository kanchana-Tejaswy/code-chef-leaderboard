import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffReadAccess } from "@/lib/auth";
import { UserRole, CohortStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await requireStaffReadAccess();
    const { searchParams } = new URL(request.url);

    const cohortId = searchParams.get("cohortId");
    const departmentId = searchParams.get("departmentId");
    const sectionId = searchParams.get("sectionId");

    // Enforce HOD scoping
    const isHod = access.role === UserRole.HOD;
    let hodDeptId: string | null = null;
    
    if (isHod) {
      if (!access.departmentId) {
        return NextResponse.json({ success: false, error: "HOD has no department assigned." }, { status: 403 });
      }
      // Resolve HOD department UUID
      const dept = await prisma.department.findFirst({
        where: {
          OR: [
            { id: access.departmentId },
            { code: access.departmentId }
          ]
        }
      });
      if (!dept) {
        return NextResponse.json({ success: false, error: "HOD department record not found." }, { status: 403 });
      }
      hodDeptId = dept.id;

      // Prevent HOD from reading other departments
      if (departmentId && departmentId !== hodDeptId) {
        return NextResponse.json({ success: false, error: "Access denied. You can only view your own department." }, { status: 403 });
      }
    }

    // CASE 1: Cohort level listing (no cohortId specified)
    if (!cohortId) {
      const cohorts = await prisma.cohort.findMany({
        orderBy: [{ startYear: "desc" }, { code: "asc" }]
      });

      const responseCohorts = await Promise.all(cohorts.map(async (c) => {
        const studentCount = await prisma.studentEnrollment.count({
          where: {
            cohortId: c.id,
            isCurrent: true,
            enrollmentStatus: "ACTIVE",
            student: { archivedAt: null },
            ...(isHod ? { departmentId: hodDeptId! } : {})
          }
        });

        const departmentCount = isHod ? 1 : await prisma.department.count({
          where: { isActive: true }
        });

        const sectionCount = await prisma.classSection.count({
          where: {
            cohortId: c.id,
            isActive: true,
            ...(isHod ? { departmentId: hodDeptId! } : {})
          }
        });

        return {
          id: c.id,
          code: c.code,
          startYear: c.startYear,
          endYear: c.endYear,
          status: c.status,
          studentCount,
          departmentCount,
          sectionCount
        };
      }));

      return NextResponse.json({ success: true, level: "cohorts", cohorts: responseCohorts });
    }

    // Resolve cohort code or info for context
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId }
    });
    if (!cohort) {
      return NextResponse.json({ success: false, error: "Cohort not found." }, { status: 404 });
    }

    // CASE 2: Department level listing (cohortId specified, no departmentId)
    // Note: For HOD, they only see their assigned department.
    if (!departmentId) {
      const departments = await prisma.department.findMany({
        where: {
          isActive: true,
          ...(isHod ? { id: hodDeptId! } : {})
        },
        orderBy: { code: "asc" }
      });

      const responseDepartments = await Promise.all(departments.map(async (d) => {
        const studentCount = await prisma.studentEnrollment.count({
          where: {
            cohortId,
            departmentId: d.id,
            isCurrent: true,
            enrollmentStatus: "ACTIVE",
            student: { archivedAt: null }
          }
        });

        const sectionCount = await prisma.classSection.count({
          where: {
            cohortId,
            departmentId: d.id,
            isActive: true
          }
        });

        return {
          id: d.id,
          code: d.code,
          name: d.name,
          studentCount,
          sectionCount
        };
      }));

      return NextResponse.json({
        success: true,
        level: "departments",
        cohort: { id: cohort.id, code: cohort.code },
        departments: responseDepartments
      });
    }

    // Resolve department code or info for context
    const department = await prisma.department.findUnique({
      where: { id: isHod ? hodDeptId! : departmentId }
    });
    if (!department) {
      return NextResponse.json({ success: false, error: "Department not found." }, { status: 404 });
    }

    // CASE 3: Section level listing (cohortId & departmentId specified, no sectionId)
    if (!sectionId) {
      const sections = await prisma.classSection.findMany({
        where: { cohortId, departmentId: department.id, isActive: true },
        orderBy: { name: "asc" }
      });

      const responseSections = await Promise.all(sections.map(async (s) => {
        const studentCount = await prisma.studentEnrollment.count({
          where: {
            cohortId,
            departmentId: department.id,
            classSectionId: s.id,
            isCurrent: true,
            enrollmentStatus: "ACTIVE",
            student: { archivedAt: null }
          }
        });

        return {
          id: s.id,
          name: s.name,
          studentCount
        };
      }));

      // Count unassigned students (where classSectionId = null)
      const unassignedCount = await prisma.studentEnrollment.count({
        where: {
          cohortId,
          departmentId: department.id,
          classSectionId: null,
          isCurrent: true,
          enrollmentStatus: "ACTIVE",
          student: { archivedAt: null }
        }
      });

      return NextResponse.json({
        success: true,
        level: "sections",
        cohort: { id: cohort.id, code: cohort.code },
        department: { id: department.id, code: department.code, name: department.name },
        sections: responseSections,
        unassignedCount
      });
    }

    // CASE 4: Student table view (cohortId, departmentId, & sectionId specified)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "active"; // "active", "archived", "all"

    const where: any = {
      cohortId,
      departmentId: department.id,
      isCurrent: true,
    };

    if (sectionId === "unassigned") {
      where.classSectionId = null;
    } else {
      where.classSectionId = sectionId;
    }

    // Build Student Profile filters
    const studentFilter: any = {};
    
    if (status === "archived") {
      studentFilter.archivedAt = { not: null };
    } else if (status === "active") {
      studentFilter.archivedAt = null;
    }

    if (search) {
      studentFilter.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { rollNumber: { contains: search, mode: "insensitive" } }
      ];
    }

    where.student = studentFilter;

    const [enrollments, total] = await Promise.all([
      prisma.studentEnrollment.findMany({
        where,
        include: {
          student: {
            include: {
              codechefProfile: { select: { currentRating: true, stars: true } },
              leetcodeProfile: { select: { problemsSolved: true } }
            }
          }
        },
        orderBy: {
          student: {
            rollNumber: "asc"
          }
        },
        skip: offset,
        take: limit
      }),
      prisma.studentEnrollment.count({ where })
    ]);

    const students = enrollments.map(e => ({
      id: e.student.id,
      name: e.student.name,
      rollNumber: e.student.rollNumber,
      email: e.student.email,
      contactNumber: e.student.contactNumber,
      cgpa: e.student.cgpa,
      year: e.student.year,
      archivedAt: e.student.archivedAt,
      profileStatus: e.student.profileStatus,
      academicYear: e.academicYear,
      enrollmentStatus: e.enrollmentStatus,
      codechefRating: e.student.codechefProfile?.currentRating || null,
      leetcodeSolved: e.student.leetcodeProfile?.problemsSolved || null
    }));

    let sectionName = "Unassigned";
    if (sectionId !== "unassigned") {
      const classSec = await prisma.classSection.findUnique({
        where: { id: sectionId }
      });
      if (classSec) {
        sectionName = classSec.name;
      }
    }

    return NextResponse.json({
      success: true,
      level: "students",
      cohort: { id: cohort.id, code: cohort.code },
      department: { id: department.id, code: department.code, name: department.name },
      section: { id: sectionId, name: sectionName },
      students,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("GET Student Directory Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
