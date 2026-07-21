import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeEmail, normalizeRollNumber, normalizeStudentLoginId } from "@/utils/normalization";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Admin Access
    await requireAdmin();

    // 2. Fetch all student profiles and user access records (read-only)
    const [students, userAccesses] = await Promise.all([
      prisma.studentProfile.findMany({
        select: { id: true, email: true, rollNumber: true, department: true }
      }),
      prisma.userAccess.findMany({
        select: { email: true, loginId: true, studentProfileId: true, authUserId: true }
      })
    ]);

    // Fast lookups
    const accessByProfileId = new Map(userAccesses.filter(ua => ua.studentProfileId).map(ua => [ua.studentProfileId, ua]));
    const accessByEmail = new Map(userAccesses.map(ua => [ua.email, ua]));
    const accessByLogin = new Map(userAccesses.map(ua => [ua.loginId, ua]));

    // Summary counts
    const summary = {
      total: students.length,
      eligible: 0,
      alreadyProvisioned: 0,
      missingEmail: 0,
      invalidEmail: 0,
      missingRollNumber: 0,
      invalidRollNumber: 0,
      missingDepartment: 0,
      emailConflict: 0,
      loginIdConflict: 0,
      studentProfileLinkageConflict: 0,
    };

    // Safe conflict info (no personal details like raw emails if avoidable, but we need some info for admin)
    // We will collect a paginated array if needed, but for now just aggregate safe fields.
    const conflicts: any[] = [];

    for (const student of students) {
      if (!student.email) {
        summary.missingEmail++;
        continue;
      }
      if (!student.rollNumber) {
        summary.missingRollNumber++;
        continue;
      }
      if (!student.department) {
        summary.missingDepartment++;
        continue;
      }

      const email = normalizeEmail(student.email);
      const rollNumber = normalizeRollNumber(student.rollNumber);
      
      if (!email) {
        summary.invalidEmail++;
        continue;
      }
      
      if (!rollNumber) {
        summary.invalidRollNumber++;
        continue;
      }

      const loginId = normalizeStudentLoginId(rollNumber);
      if (!loginId) {
        summary.invalidRollNumber++;
        continue;
      }

      const existingByProfile = accessByProfileId.get(student.id);
      if (existingByProfile && existingByProfile.authUserId) {
        summary.alreadyProvisioned++;
        continue;
      }

      const existingByEmail = accessByEmail.get(email);
      if (existingByEmail && existingByEmail.studentProfileId !== student.id) {
        summary.emailConflict++;
        conflicts.push({ type: "EMAIL_CONFLICT", studentProfileId: student.id, message: "Email is used by another account." });
        continue;
      }

      const existingByLogin = accessByLogin.get(loginId);
      if (existingByLogin && existingByLogin.studentProfileId !== student.id) {
        summary.loginIdConflict++;
        conflicts.push({ type: "LOGIN_ID_CONFLICT", studentProfileId: student.id, message: "Login ID is used by another account." });
        continue;
      }
      
      if (existingByProfile && !existingByProfile.authUserId) {
        // Edge case: UserAccess exists but authUserId is missing (partially provisioned/failed)
        summary.studentProfileLinkageConflict++;
        conflicts.push({ type: "PARTIAL_LINKAGE", studentProfileId: student.id, message: "Account partially provisioned (missing Auth ID)." });
        continue;
      }

      // If we made it here, they are eligible for provisioning
      summary.eligible++;
    }

    // Truncate conflicts to return safely, e.g. max 100 for preview
    const safeConflicts = conflicts.slice(0, 100);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        conflicts: safeConflicts,
      }
    }, {
      headers: {
        "Cache-Control": "private, no-store"
      }
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in students preview API:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
