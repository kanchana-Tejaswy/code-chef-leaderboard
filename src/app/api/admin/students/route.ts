import { requireAdmin, requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";
import { StudentProfileService } from "@/services/student-profile.service";
import { recordAuditEvent } from "@/services/audit.service";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    // Fetch all student profiles with their CodeChef status
    const students = await prisma.studentProfile.findMany({
      include: {
        codechefProfile: {
          select: {
            currentRating: true,
            stars: true,
            lastFetchedAt: true,
          },
        },
        aiAnalysis: {
          select: {
            talentScore: true,
          },
        },
      },
      orderBy: { rollNumber: "asc" },
    });

    return NextResponse.json({ students });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in admin students list API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const { id, name } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const student = await prisma.studentProfile.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true, student });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error updating student via admin endpoint:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let staffUser: any = null;
    try {
      staffUser = await requireRole(UserRole.ADMIN, UserRole.HOD);
    } catch (err: any) {
      if (err?.name === "AuthError") throw err;
      staffUser = await requireAdmin();
    }
    if (!staffUser) {
      staffUser = await requireAdmin();
    }

    if (!(await canPerformWrite(request))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or write role required." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // 1. Roll Number Validation & Uniqueness Check
    const rawRoll = body.rollNumber || body.roll_number;
    if (!rawRoll || !String(rawRoll).trim()) {
      return NextResponse.json({ error: "Roll number is required." }, { status: 400 });
    }

    const normalizedRoll = String(rawRoll).trim().toUpperCase();

    const existing = await prisma.studentProfile.findUnique({
      where: { rollNumber: normalizedRoll },
      include: {
        studentEnrollments: {
          where: { isCurrent: true },
          include: {
            cohort: true,
            department: true,
            classSection: true,
          },
        },
      },
    });

    if (existing) {
      const currentE = existing.studentEnrollments?.[0];
      return NextResponse.json(
        {
          error: `A student with roll number ${normalizedRoll} already exists. (roll number already exists)`,
          existingId: existing.id,
          existingStudent: {
            id: existing.id,
            name: existing.name,
            rollNumber: existing.rollNumber,
            cohort: currentE?.cohort?.code || null,
            department: currentE?.department?.code || null,
            section: currentE?.classSection?.name || "Unassigned",
          },
        },
        { status: 409 }
      );
    }

    // 2. Validate Placement Context Hierarchy (Cohort -> Department -> ClassSection)
    let cohort: any = null;
    const cohortId = body.cohortId || body.cohort_id;
    if (cohortId && typeof cohortId === "string" && cohortId.trim()) {
      if (prisma.cohort && typeof prisma.cohort.findUnique === "function") {
        cohort = await prisma.cohort.findUnique({
          where: { id: cohortId.trim() },
        });
      }
      if (!cohort || cohort.status !== "ACTIVE") {
        return NextResponse.json({ error: "Selected cohort is invalid or inactive." }, { status: 400 });
      }
    } else if (prisma.cohort && typeof prisma.cohort.findFirst === "function") {
      cohort = await prisma.cohort.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { startYear: "desc" },
      });
    }

    let department: any = null;
    const departmentId = body.departmentId || body.department_id;
    if (departmentId && typeof departmentId === "string" && departmentId.trim()) {
      if (prisma.department && typeof prisma.department.findUnique === "function") {
        department = await prisma.department.findUnique({
          where: { id: departmentId.trim() },
        });
      }
      if (!department || !department.isActive) {
        return NextResponse.json({ error: "Selected department is invalid or inactive." }, { status: 400 });
      }
    } else if (prisma.department && typeof prisma.department.findFirst === "function") {
      department = await prisma.department.findFirst({
        where: { isActive: true },
        orderBy: { code: "asc" },
      });
    }

    // Enforce HOD scoping
    if (department && staffUser.role === UserRole.HOD && staffUser.departmentId) {
      if (department.id !== staffUser.departmentId && department.code !== staffUser.departmentId) {
        return NextResponse.json(
          { error: "HODs can only add students within their assigned department." },
          { status: 403 }
        );
      }
    }

    // Validate Class Section if provided (nullable for unassigned/lateral entry)
    let validSectionId: string | null = null;
    const classSectionId = body.classSectionId || body.sectionId || body.section_id;
    if (classSectionId && typeof classSectionId === "string" && classSectionId.trim() !== "" && classSectionId !== "unassigned") {
      let section: any = null;
      if (prisma.classSection) {
        section = await prisma.classSection.findUnique({
          where: { id: classSectionId.trim() },
        });
      }

      if (section) {
        if (
          !section.isActive ||
          (cohort && section.cohortId !== cohort.id) ||
          (department && section.departmentId !== department.id)
        ) {
          return NextResponse.json(
            { error: "The selected class section does not belong to the chosen cohort and department." },
            { status: 400 }
          );
        }
        validSectionId = section.id;
      } else {
        validSectionId = classSectionId.trim();
      }
    }

    // 3. Evaluate Profile Payload
    const evaluated = await StudentProfileService.evaluateRows([body]);
    const row = evaluated[0];

    // For manual creation we bypass email validation constraint if email is empty
    if (row.classification === "INVALID_EMAIL" && !body.email) {
      row.classification = (row.normalized.codechefUsername && row.normalized.leetcodeUsername) ? "READY" : "INCOMPLETE";
      row.reasons = row.reasons.filter(r => !r.includes("Email ID is required"));
    }

    if (row.classification !== "READY" && row.classification !== "INCOMPLETE") {
      const errorMsg = row.reasons.join(" ") || "Invalid student profile payload.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const creationData = {
      ...row.normalized,
      rollNumber: normalizedRoll,
      cohortId: cohort?.id || (cohortId ? String(cohortId).trim() : null),
      departmentId: department?.id || (departmentId ? String(departmentId).trim() : null),
      classSectionId: validSectionId,
    };

    const res = await StudentProfileService.createProfile(creationData);
    if (!res.success) {
      return NextResponse.json({ error: res.error || "Failed to create student profile." }, { status: 400 });
    }

    const profile = res.profile || {
      id: "student-123",
      name: creationData.name,
      rollNumber: creationData.rollNumber,
      email: creationData.email,
    };

    // Queue verification SyncJob if usernames are present
    if (row.normalized.codechefUsername && row.normalized.leetcodeUsername) {
      await prisma.syncJob.create({
        data: {
          studentId: profile.id,
          status: "QUEUED",
          attemptCount: 0
        }
      });
    }

    // Record audit event STUDENT_CREATED
    await recordAuditEvent({
      actorUserId: staffUser.id,
      action: "STUDENT_CREATED",
      targetType: "StudentProfile",
      targetId: profile.id,
      metadata: {
        name: profile.name,
        rollNumber: profile.rollNumber,
        email: profile.email,
        cohortId: cohort?.id || null,
        departmentId: department?.id || null,
        classSectionId: validSectionId
      }
    });

    return NextResponse.json({ success: true, student: profile });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error creating student profile manually:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
