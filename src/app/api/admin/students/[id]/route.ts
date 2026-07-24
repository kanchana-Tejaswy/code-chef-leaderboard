import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";
import { SyncService } from "@/services/sync.service";
import { revalidatePath } from "next/cache";
import { normalizeAndValidateUrl } from "@/utils/urlValidation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
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
      department, 
      year, 
      branch, 
      section, 
      codechefUsername, 
      leetcodeUsername, 
      githubUsername,
      linkedinUrl
    } = body;

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
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
          { error: "Email address is permanent and cannot be modified." },
          { status: 400 }
        );
      }
    }

    const { isValid: isCcValid, handle: newCodechef, error: ccError } = normalizeAndValidateUrl(codechefUsername, "codechef");
    if (!isCcValid) {
      return NextResponse.json({ error: ccError }, { status: 400 });
    }

    const { isValid: isLcValid, handle: newLeetcode, error: lcError } = normalizeAndValidateUrl(leetcodeUsername, "leetcode");
    if (!isLcValid) {
      return NextResponse.json({ error: lcError }, { status: 400 });
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
      oldStudent.githubUsername !== newGithub ||
      oldStudent.linkedinUrl !== newLinkedin;

    // Update database record (preserving permanent email & rollNumber)
    const updatedStudent = await prisma.studentProfile.update({
      where: { id: studentId },
      data: { 
        name: name.trim(),
        department: department?.trim() || null,
        year: year ? parseInt(year, 10) : null,
        branch: branch?.trim() || null,
        section: section?.trim() || null,
        codechefUsername: newCodechef,
        leetcodeUsername: newLeetcode,
        githubUsername: newGithub,
        linkedinUrl: newLinkedin,
      },
    });

    // Sync updates to UserAccess
    await prisma.userAccess.updateMany({
      where: { studentProfileId: studentId },
      data: {
        ...(email?.trim() ? { email: email.trim() } : {}),
        ...(rollNumber?.trim() ? { loginId: rollNumber.trim() } : {}),
        ...(department?.trim() ? { departmentId: department.trim() } : {}),
      }
    });

    if (isPlatformChanged) {
      // Changed platform URLs trigger profile resync
      const syncResult = await SyncService.syncStudent(studentId, "ADMIN_FORCE");
      if (!syncResult.success) {
        console.error("Sync failed after admin update:", syncResult.error);
      }
    } else {
      // If no platform URLs were changed, we invalidate caches directly since sync is skipped
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath(`/student/${studentId}`);
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
