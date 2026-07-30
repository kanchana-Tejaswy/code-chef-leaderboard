import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id: studentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { newRollNumber, newEmail } = body;

    if (!studentId) {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { userAccess: true }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const updates: any = {};
    const userAccessUpdates: any = {};
    const changedFields: string[] = [];

    // Validate newRollNumber
    if (newRollNumber !== undefined && newRollNumber !== null && newRollNumber.trim() !== "") {
      const cleanedRoll = newRollNumber.trim().toUpperCase();
      if (cleanedRoll !== student.rollNumber) {
        // Check uniqueness in StudentProfile
        const duplicateStudent = await prisma.studentProfile.findUnique({
          where: { rollNumber: cleanedRoll }
        });
        if (duplicateStudent) {
          return NextResponse.json({ error: `Roll number ${cleanedRoll} is already in use.` }, { status: 409 });
        }
        // Check uniqueness in UserAccess
        const duplicateAccess = await prisma.userAccess.findUnique({
          where: { loginId: cleanedRoll }
        });
        if (duplicateAccess) {
          return NextResponse.json({ error: `Roll number ${cleanedRoll} login ID is already in use.` }, { status: 409 });
        }
        updates.rollNumber = cleanedRoll;
        userAccessUpdates.loginId = cleanedRoll;
        changedFields.push("rollNumber");
      }
    }

    // Validate newEmail
    if (newEmail !== undefined && newEmail !== null && newEmail.trim() !== "") {
      const cleanedEmail = newEmail.trim().toLowerCase();
      if (cleanedEmail !== student.email) {
        // Check uniqueness in StudentProfile
        const duplicateStudent = await prisma.studentProfile.findUnique({
          where: { email: cleanedEmail }
        });
        if (duplicateStudent) {
          return NextResponse.json({ error: `Email ${cleanedEmail} is already in use.` }, { status: 409 });
        }
        // Check uniqueness in UserAccess
        const duplicateAccess = await prisma.userAccess.findUnique({
          where: { email: cleanedEmail }
        });
        if (duplicateAccess) {
          return NextResponse.json({ error: `Email ${cleanedEmail} is already in use.` }, { status: 409 });
        }
        updates.email = cleanedEmail;
        userAccessUpdates.email = cleanedEmail;
        changedFields.push("email");
      }
    }

    if (changedFields.length === 0) {
      return NextResponse.json({ error: "No identity changes requested." }, { status: 400 });
    }

    // Try updating Supabase Auth first to avoid silent database success followed by Auth failure
    let authUpdated = false;
    if (updates.email && student.userAccess?.authUserId) {
      try {
        const supabaseAdmin = createAdminClient();
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          student.userAccess.authUserId,
          { email: updates.email }
        );
        if (error) {
          return NextResponse.json({ error: `Supabase Auth update failed: ${error.message}` }, { status: 500 });
        }
        authUpdated = true;
      } catch (authErr: any) {
        return NextResponse.json({ error: `Supabase Admin Auth error: ${authErr.message || authErr}` }, { status: 500 });
      }
    }

    try {
      // Update in database safely
      await prisma.$transaction(async (tx) => {
        if (Object.keys(updates).length > 0) {
          await tx.studentProfile.update({
            where: { id: studentId },
            data: updates
          });
        }
        if (Object.keys(userAccessUpdates).length > 0) {
          await tx.userAccess.update({
            where: { studentProfileId: studentId },
            data: userAccessUpdates
          });
        }
      });
    } catch (dbErr: any) {
      // Compensating rollback for Supabase Auth to prevent inconsistent state
      if (authUpdated && student.userAccess?.authUserId && student.email) {
        try {
          const supabaseAdmin = createAdminClient();
          await supabaseAdmin.auth.admin.updateUserById(
            student.userAccess.authUserId,
            { email: student.email }
          );
        } catch (rollbackErr) {
          console.error("CRITICAL: Failed to roll back Supabase Auth user email during db update failure:", rollbackErr);
        }
      }
      return NextResponse.json({ error: `Database update failed: ${dbErr.message || dbErr}` }, { status: 500 });
    }

    // Record audit log using STUDENT_IDENTITY_CHANGED
    await recordAuditEvent({
      actorUserId: admin.id,
      action: "STUDENT_IDENTITY_CHANGED",
      targetType: "StudentProfile",
      targetId: studentId,
      metadata: { changedFields, oldRoll: student.rollNumber, oldEmail: student.email, newRoll: updates.rollNumber, newEmail: updates.email }
    });

    const updatedStudent = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
        aiAnalysis: true,
        leaderboardEntry: true
      }
    });

    return NextResponse.json({ success: true, student: updatedStudent });

  } catch (err: any) {
    console.error("Identity update error:", err);
    if (err.name === "AuthError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: err.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
