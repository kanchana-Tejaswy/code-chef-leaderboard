import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { UserRole, AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { normalizeEmail, normalizeRollNumber, normalizeStudentLoginId, normalizeStaffLoginId } from "@/utils/normalization";
import { validateAdminPassword } from "@/utils/password-policy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdmin();

    const body = await request.json();
    const {
      fullName: rawFullNameLegacy,
      email: rawEmailLegacy,
      role,
      departmentId,
      rollNumber: rawRollNumber,
      password: passwordLegacy,
      confirmPassword: confirmPasswordLegacy,
      status: requestedStatus,
      adminConfirmation,
      newAccountFullName,
      newAccountEmail,
      newAccountPassword,
      newAccountConfirmPassword,
    } = body;

    const rawFullName = newAccountFullName !== undefined ? newAccountFullName : rawFullNameLegacy;
    const rawEmail = newAccountEmail !== undefined ? newAccountEmail : rawEmailLegacy;
    const password = newAccountPassword !== undefined ? newAccountPassword : passwordLegacy;
    const confirmPassword = newAccountConfirmPassword !== undefined ? newAccountConfirmPassword : confirmPasswordLegacy;

    const isStaff = role === UserRole.ADMIN || role === UserRole.GK_SIR || role === UserRole.HOD;
    const useActivationFlow = isStaff && !password;

    // 1. Basic Required Fields
    if (!rawEmail || !role || (!password && !isStaff)) {
      return NextResponse.json(
        { success: false, error: "Email, role, and temporary password are required." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (password && password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Passwords do not match." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // 2. Role Validation
    const validRoles = [UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD, UserRole.STUDENT];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role specified." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // 3. Admin Account Creation Security
    if (role === UserRole.ADMIN) {
      if (adminConfirmation !== "GRANT ADMIN ACCESS") {
        return NextResponse.json(
          { success: false, error: "Creating an ADMIN account requires typing exact confirmation 'GRANT ADMIN ACCESS'." },
          { status: 400, headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }

    let passwordToUse = password;
    if (useActivationFlow) {
      passwordToUse = "StaffTempPass#" + Math.random().toString(36).slice(-8) + "2026!";
    }

    // 4. Password Policy Validation
    if (!useActivationFlow) {
      const pwdValidation = validateAdminPassword(passwordToUse);
      if (!pwdValidation.valid) {
        return NextResponse.json(
          { success: false, error: pwdValidation.error },
          { status: 400, headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }

    // 5. Normalization & Login ID assignment
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Invalid email format." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const fullName = rawFullName ? String(rawFullName).trim() : "";
    const accountStatus = requestedStatus === AccountStatus.ACTIVE ? AccountStatus.ACTIVE : AccountStatus.PENDING;

    let loginId: string | null = null;
    let studentProfileId: string | null = null;
    let deptIdToUse: string | null = departmentId || null;

    if (role === UserRole.STUDENT) {
      const rollNumber = normalizeRollNumber(rawRollNumber || "");
      if (!rollNumber) {
        return NextResponse.json(
          { success: false, error: "Roll number is required for STUDENT accounts." },
          { status: 400, headers: { "Cache-Control": "private, no-store" } }
        );
      }

      loginId = normalizeStudentLoginId(rollNumber);

      // Section 14: Search by normalized roll number. Do not create a duplicate StudentProfile.
      const existingStudentProfile = await prisma.studentProfile.findFirst({
        where: {
          OR: [
            { rollNumber: { equals: rollNumber, mode: "insensitive" } },
            { email: { equals: email, mode: "insensitive" } }
          ]
        }
      });

      if (!existingStudentProfile) {
        return NextResponse.json(
          { success: false, error: "No Student Profile exists for this roll number. Create or import the Student Profile first." },
          { status: 400, headers: { "Cache-Control": "private, no-store" } }
        );
      }

      studentProfileId = existingStudentProfile.id;
      deptIdToUse = existingStudentProfile.department || deptIdToUse;

    } else {
      // For ADMIN, GK_SIR, HOD
      loginId = normalizeStaffLoginId(email);
      if (role === UserRole.HOD && !deptIdToUse) {
        return NextResponse.json(
          { success: false, error: "Department is required when role is HOD." },
          { status: 400, headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }

    if (!loginId) {
      return NextResponse.json(
        { success: false, error: "Could not generate login ID." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // 6. Pre-check Duplicates in UserAccess
    const existingUserAccess = await prisma.userAccess.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { loginId: { equals: loginId, mode: "insensitive" } },
          ...(studentProfileId ? [{ studentProfileId }] : [])
        ]
      }
    });

    // 7. Pre-check Duplicates in Supabase Auth
    const supabaseAdmin = createAdminClient();
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUserAccess || existingAuthUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account already exists with this email address."
        },
        { status: 409, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // 8. Create Supabase Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: passwordToUse,
      email_confirm: true,
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { success: false, error: authError?.message || "Failed to create Supabase Auth user." },
        { status: 500, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const newAuthUserId = authData.user.id;

    // 9. Atomic DB Creation & Failure Rollback Safety
    try {
      const createdUserAccess = await prisma.userAccess.create({
        data: {
          authUserId: newAuthUserId,
          email,
          loginId,
          role,
          status: useActivationFlow ? AccountStatus.PENDING : accountStatus,
          departmentId: deptIdToUse,
          studentProfileId,
          mustSetPassword: useActivationFlow ? true : false,
          firstLoginCompleted: useActivationFlow ? false : true,
          approvedAt: new Date(),
          approvedBy: adminSession.authUserId || undefined,
          passwordSetAt: useActivationFlow ? null : new Date(),
        }
      });

      // Also create/update Profile if staff or name provided
      if (role !== UserRole.STUDENT && (fullName || email)) {
        await prisma.profile.upsert({
          where: { email },
          update: {
            authUserId: newAuthUserId,
            name: fullName || email.split("@")[0],
            role,
            department: deptIdToUse
          },
          create: {
            authUserId: newAuthUserId,
            email,
            name: fullName || email.split("@")[0],
            role,
            department: deptIdToUse
          }
        });
      }

      // Record Audit Event
      const auditAction =
        role === UserRole.ADMIN
          ? AuditAction.ADMIN_ACCOUNT_CREATED
          : role === UserRole.STUDENT
          ? AuditAction.STUDENT_ACCOUNT_PROVISIONED
          : AuditAction.STAFF_ACCOUNT_PROVISIONED;

      await recordAuditEvent({
        actorUserId: adminSession.id,
        action: auditAction,
        targetType: "UserAccess",
        targetId: createdUserAccess.id,
        metadata: {
          email,
          role,
          status: useActivationFlow ? AccountStatus.PENDING : accountStatus,
          loginId,
          departmentId: deptIdToUse
        }
      });

      if (useActivationFlow) {
        const { error: resetLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (resetLinkError) {
          console.error(`Failed to generate first-login link for ${email}:`, resetLinkError);
        }
      }

      return NextResponse.json(
        {
          success: true,
          message: useActivationFlow 
            ? `Account successfully provisioned for ${email}. Secure activation link has been sent.`
            : `Account successfully provisioned for ${email}.`,
          data: {
            userAccessId: createdUserAccess.id,
            authUserId: newAuthUserId,
            loginId,
            role,
            status: useActivationFlow ? AccountStatus.PENDING : accountStatus
          }
        },
        { status: 201, headers: { "Cache-Control": "private, no-store" } }
      );

    } catch (dbError: any) {
      // Rollback Safety: Delete orphan auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
      } catch (rollbackError) {
        console.error("Failed to delete orphan Supabase user during rollback:", rollbackError);
      }

      return NextResponse.json(
        { success: false, error: `Database creation failed: ${dbError.message}` },
        { status: 500, headers: { "Cache-Control": "private, no-store" } }
      );
    }

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json(
        { success: false, error: err.message },
        { status, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    console.error("Error in POST /api/admin/accounts/provision:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
