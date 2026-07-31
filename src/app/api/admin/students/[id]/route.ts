import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";
import { revalidatePath } from "next/cache";
import { normalizeAndValidateUrl } from "@/utils/urlValidation";
import { recordAuditEvent } from "@/services/audit.service";
import { SyncService } from "@/services/sync.service";
import { createAdminClient } from "@/utils/supabase/admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!(await canPerformWrite(request))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin role required or write access disabled." },
        { status: 403 }
      );
    }

    const { id: studentId } = await params;
    const body = await request.json().catch(() => ({}));
    
    const { 
      name, 
      email,
      rollNumber,
      contactNumber,
      year, 
      branch, 
      cgpa,
      codechefUsername, 
      leetcodeUsername, 
      codeforcesUsername,
      githubUsername,
      linkedinUrl
    } = body;

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const cleanedName = name.trim().replace(/\s+/g, " ");

    if (branch !== undefined && branch !== null && typeof branch === "string" && !branch.trim()) {
      return NextResponse.json({ error: "Branch is required." }, { status: 400 });
    }

    // Retrieve old student record to check if usernames or immutable fields changed
    const oldStudent = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!oldStudent) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Server-side security check: reject any attempt to modify rollNumber or email
    if (body.hasOwnProperty("rollNumber") || body.hasOwnProperty("roll_number")) {
      const reqRoll = body.hasOwnProperty("rollNumber") ? body.rollNumber : body.roll_number;
      const normReqRoll = reqRoll ? String(reqRoll).trim().toUpperCase() : null;
      const normOldRoll = oldStudent.rollNumber ? oldStudent.rollNumber.trim().toUpperCase() : null;
      if (normOldRoll && normReqRoll !== normOldRoll) {
        return NextResponse.json(
          { error: "Roll number is permanent and cannot be changed." },
          { status: 400 }
        );
      }
    }

    if (body.hasOwnProperty("email")) {
      const reqEmail = body.email ? String(body.email).trim().toLowerCase() : null;
      const normOldEmail = oldStudent.email ? oldStudent.email.trim().toLowerCase() : null;
      if (normOldEmail && reqEmail !== normOldEmail) {
        return NextResponse.json(
          { error: "Registered email cannot be changed." },
          { status: 400 }
        );
      }
    }

    // Year validation (1, 2, 3, 4)
    let parsedYear: number | null = null;
    if (year !== undefined && year !== null && String(year).trim() !== "") {
      const yVal = typeof year === "number" ? year : parseInt(String(year).trim(), 10);
      if (isNaN(yVal) || ![1, 2, 3, 4].includes(yVal)) {
        return NextResponse.json(
          { error: "Year of Study must be 1, 2, 3, or 4." },
          { status: 400 }
        );
      }
      parsedYear = yVal;
    }

    // CGPA validation (0 to 10)
    let parsedCgpa: number | null = null;
    if (cgpa !== undefined && cgpa !== null && String(cgpa).trim() !== "") {
      const cVal = typeof cgpa === "number" ? cgpa : parseFloat(String(cgpa).trim());
      if (isNaN(cVal) || cVal < 0 || cVal > 10) {
        return NextResponse.json(
          { error: "CGPA must be a number between 0 and 10." },
          { status: 400 }
        );
      }
      parsedCgpa = cVal;
    }

    const { isValid: isCcValid, handle: newCodechef, error: ccError } = normalizeAndValidateUrl(codechefUsername, "codechef");
    if (!isCcValid) {
      return NextResponse.json({ error: ccError }, { status: 400 });
    }

    const { isValid: isLcValid, handle: newLeetcode, error: lcError } = normalizeAndValidateUrl(leetcodeUsername, "leetcode");
    if (!isLcValid) {
      return NextResponse.json({ error: lcError }, { status: 400 });
    }

    const { isValid: isCfValid, handle: newCodeforces, error: cfError } = normalizeAndValidateUrl(codeforcesUsername, "codeforces");
    if (!isCfValid) {
      return NextResponse.json({ error: cfError }, { status: 400 });
    }

    const { isValid: isGithubValid, handle: newGithub, error: githubError } = normalizeAndValidateUrl(githubUsername, "github");
    if (!isGithubValid) {
      return NextResponse.json({ error: githubError }, { status: 400 });
    }
    
    const { isValid: isLinkedinValid, normalizedUrl: newLinkedin, error: linkedinError } = normalizeAndValidateUrl(linkedinUrl, "linkedin");
    if (!isLinkedinValid) {
      return NextResponse.json({ error: linkedinError }, { status: 400 });
    }

    const isPlatformChanged = 
      oldStudent.codechefUsername !== newCodechef ||
      oldStudent.leetcodeUsername !== newLeetcode ||
      oldStudent.codeforcesUsername !== newCodeforces ||
      oldStudent.githubUsername !== newGithub ||
      oldStudent.linkedinUrl !== newLinkedin;

    const updates: any = {
      name: cleanedName,
      contactNumber: contactNumber !== undefined ? (contactNumber ? String(contactNumber).trim() : null) : oldStudent.contactNumber,
      year: parsedYear !== null ? parsedYear : oldStudent.year,
      branch: branch ? String(branch).trim() : oldStudent.branch,
      department: branch ? String(branch).trim() : oldStudent.department,
      cgpa: parsedCgpa !== null ? parsedCgpa : oldStudent.cgpa,
      codechefUsername: newCodechef,
      leetcodeUsername: newLeetcode,
      codeforcesUsername: newCodeforces,
      githubUsername: newGithub,
      linkedinUrl: newLinkedin,
    };

    if (isPlatformChanged) {
      const ccComplete = Boolean(newCodechef && newCodechef.trim() !== "");
      const lcComplete = Boolean(newLeetcode && newLeetcode.trim() !== "");
      updates.verificationStatus = "UNABLE_TO_VERIFY";
      updates.profileStatus = (ccComplete && lcComplete) ? "PENDING_VERIFICATION" : "INCOMPLETE";
      updates.leaderboardEligible = false;
      updates.dashboardEligible = false;
    }

    // Update database record (preserving permanent email & rollNumber)
    const updatedStudent = await prisma.studentProfile.update({
      where: { id: studentId },
      data: updates,
    });

    // Sync updates to UserAccess
    await prisma.userAccess.updateMany({
      where: { studentProfileId: studentId },
      data: {
        ...(email?.trim() ? { email: email.trim() } : {}),
        ...(rollNumber?.trim() ? { loginId: rollNumber.trim() } : {}),
        ...(branch?.trim() ? { departmentId: branch.trim() } : {}),
      }
    });

    if (isPlatformChanged) {
      // Create exactly one SyncJob queue record in database
      await prisma.syncJob.deleteMany({
        where: { studentId, status: "QUEUED" }
      });
      await prisma.syncJob.create({
        data: {
          studentId,
          status: "QUEUED",
          attemptCount: 0
        }
      });

      // Record audit event
      const changedUrls: string[] = [];
      if (oldStudent.codechefUsername !== newCodechef) changedUrls.push("codechefUsername");
      if (oldStudent.leetcodeUsername !== newLeetcode) changedUrls.push("leetcodeUsername");
      if (oldStudent.codeforcesUsername !== newCodeforces) changedUrls.push("codeforcesUsername");
      if (oldStudent.githubUsername !== newGithub) changedUrls.push("githubUsername");
      if (oldStudent.linkedinUrl !== newLinkedin) changedUrls.push("linkedinUrl");

      await recordAuditEvent({
        actorUserId: admin.id,
        action: "STUDENT_PLATFORM_URL_CHANGED",
        targetType: "StudentProfile",
        targetId: studentId,
        metadata: { changedFields: changedUrls }
      });
    } else {
      const changedFields: string[] = [];
      if (oldStudent.name !== cleanedName) changedFields.push("name");
      if (oldStudent.contactNumber !== contactNumber) changedFields.push("contactNumber");
      if (oldStudent.year !== parsedYear && parsedYear !== null) changedFields.push("year");
      if (oldStudent.branch !== branch && branch) changedFields.push("branch");
      if (oldStudent.cgpa !== parsedCgpa && parsedCgpa !== null) changedFields.push("cgpa");

      if (changedFields.length > 0) {
        await recordAuditEvent({
          actorUserId: admin.id,
          action: "STUDENT_UPDATED",
          targetType: "StudentProfile",
          targetId: studentId,
          metadata: { changedFields }
        });
      }
    }

    // Invalidate caches
    try {
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath(`/student/${studentId}`);
    } catch (e) {
      // ignore
    }

    // Fetch the updated student profile with included data to return to the frontend
    const finalStudent = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: {
            codechefProfile: true,
            leetcodeProfile: true,
            githubProfile: true,
            aiAnalysis: true,
            leaderboardEntry: true,
        },
    });

    return NextResponse.json({ success: true, student: finalStudent });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error updating student details:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    
    // Check delete permission in DB UserAccess record
    if (!admin.canDeleteStudents) {
      return NextResponse.json(
        { error: "Insufficient permissions. Student deletion access is disabled." },
        { status: 403 }
      );
    }

    const { id: studentId } = await params;
    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { reason, notes, confirm } = body;

    if (confirm !== "DELETE") {
      return NextResponse.json({ error: "Typed confirmation 'DELETE' is required." }, { status: 400 });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json({ error: "Deletion reason is required." }, { status: 400 });
    }

    if (reason === "Other" && (!notes || typeof notes !== "string" || !notes.trim())) {
      return NextResponse.json({ error: "A note is required when selecting 'Other' reason." }, { status: 400 });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { userAccess: true }
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }

    // Handle Supabase Auth account and UserAccess relation
    const authUserId = student.userAccess?.authUserId;
    if (authUserId) {
      const supabaseAdmin = createAdminClient();
      
      // Disable first
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        ban_duration: "876000h"
      });
      if (banError) {
        console.error(`Failed to ban/disable Supabase user ${authUserId}:`, banError);
      }

      // Delete Auth account
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (deleteAuthError) {
        console.error(`Failed to delete Supabase user ${authUserId}:`, deleteAuthError);
      }
    }

    // Execute relational database deletion inside transaction
    await prisma.$transaction(async (tx) => {
      await tx.syncJob.deleteMany({ where: { studentId } });
      await tx.leaderboardEntry.deleteMany({ where: { studentId } });
      await tx.codechefProfile.deleteMany({ where: { studentId } });
      await tx.leetcodeProfile.deleteMany({ where: { studentId } });
      await tx.githubProfile.deleteMany({ where: { studentId } });
      await tx.aiAnalysis.deleteMany({ where: { studentId } });
      await tx.syncLog.deleteMany({ where: { studentId } });
      await tx.activityLog.deleteMany({ where: { studentId } });
      await tx.normalizedProfile.deleteMany({ where: { studentId } });
      await tx.userAccess.deleteMany({ where: { studentProfileId: studentId } });
      await tx.studentProfile.delete({ where: { id: studentId } });
    });

    // Record audit event
    const rollSnapshot = student.rollNumber ? student.rollNumber.trim() : "N/A";
    const maskedRoll = rollSnapshot !== "N/A"
      ? rollSnapshot.substring(0, 2) + "****" + rollSnapshot.substring(rollSnapshot.length - 2)
      : "N/A";

    await recordAuditEvent({
      actorUserId: admin.id,
      action: "STUDENT_DELETED",
      targetType: "StudentProfile",
      targetId: studentId,
      metadata: {
        email: student.email,
        name: student.name,
        rollNumber: maskedRoll,
        reason,
        notes
      }
    });

    // Recalculate leaderboard ranks
    await SyncService.recalculateLeaderboardRanks();

    // Invalidate caches
    try {
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath(`/student/${studentId}`);
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ success: true, message: "Student deleted successfully." });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error deleting student profile:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
