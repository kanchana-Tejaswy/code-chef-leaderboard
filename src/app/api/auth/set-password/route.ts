import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { createClient } from "@/utils/supabase/server";
import { validatePassword } from "@/utils/password-policy";

function getRoleRedirect(role: UserRole, studentProfileId?: string | null): string {
  switch (role) {
    case UserRole.ADMIN:
      return "/dashboard";
    case UserRole.GK_SIR:
    case UserRole.HOD:
      return "/leaderboard";
    case UserRole.STUDENT:
      return studentProfileId ? `/student/${studentProfileId}` : "/login";
    default:
      return "/login";
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ success: false, message: "Invalid Content-Type" }, { status: 415, headers: { "Cache-Control": "no-store" } });
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 5000) {
      return NextResponse.json({ success: false, message: "Payload too large" }, { status: 413, headers: { "Cache-Control": "no-store" } });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const { password, confirmPassword } = body;
    if (!password || !confirmPassword) {
      return NextResponse.json({ success: false, message: "Password is required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const targetUserAccess = await prisma.userAccess.findUnique({
      where: { authUserId: user.id },
      include: {
        studentProfile: true
      }
    });

    if (!targetUserAccess) {
      await supabase.auth.signOut();
      return NextResponse.json({ success: false, message: "Account not found" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    // Role specific requirements
    if (targetUserAccess.role === UserRole.STUDENT && !targetUserAccess.studentProfileId) {
      await supabase.auth.signOut();
      return NextResponse.json({ success: false, message: "Invalid account setup" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    if (targetUserAccess.role === UserRole.HOD && !targetUserAccess.departmentId) {
      await supabase.auth.signOut();
      return NextResponse.json({ success: false, message: "Invalid account setup" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    // Is the user already active and trying to hit this API again (idempotent recovery)
    if (
      targetUserAccess.status === AccountStatus.ACTIVE &&
      targetUserAccess.mustSetPassword === false &&
      targetUserAccess.firstLoginCompleted === true
    ) {
      return NextResponse.json({
        success: true,
        redirectTo: getRoleRedirect(targetUserAccess.role, targetUserAccess.studentProfileId)
      }, { headers: { "Cache-Control": "no-store" } });
    }

    // Security constraints for setting first password
    if (
      targetUserAccess.status !== AccountStatus.PENDING ||
      targetUserAccess.mustSetPassword !== true ||
      targetUserAccess.firstLoginCompleted !== false ||
      user.email?.toLowerCase() !== targetUserAccess.email.toLowerCase()
    ) {
      await recordAuditEvent({
        action: AuditAction.SESSION_MISMATCH,
        targetId: targetUserAccess.id,
        metadata: { reason: "Account state or email mismatch during password setup" },
      });
      await supabase.auth.signOut();
      return NextResponse.json({ success: false, message: "Invalid session state" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    // Validate Password Policy
    const validationResult = validatePassword(password, confirmPassword, {
      email: targetUserAccess.email,
      rollNumber: targetUserAccess.studentProfile?.rollNumber || undefined,
      fullName: targetUserAccess.studentProfile?.name || undefined
    });

    if (!validationResult.isValid) {
      await recordAuditEvent({
        action: AuditAction.FIRST_PASSWORD_SET_FAILED,
        targetId: targetUserAccess.id,
        metadata: { reason: "Password policy violation" },
      });
      return NextResponse.json({ success: false, message: validationResult.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    // Update password in Supabase
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      await recordAuditEvent({
        action: AuditAction.FIRST_PASSWORD_SET_FAILED,
        targetId: targetUserAccess.id,
        metadata: { error: updateError.message },
      });
      return NextResponse.json({ success: false, message: "Temporary failure updating password" }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }

    // Activate Account in Prisma
    try {
      await prisma.$transaction(async (tx) => {
        await tx.userAccess.update({
          where: { id: targetUserAccess.id },
          data: {
            status: AccountStatus.ACTIVE,
            mustSetPassword: false,
            firstLoginCompleted: true,
            passwordSetAt: new Date(),
            lastLoginAt: new Date()
          }
        });
      });
    } catch (prismaError) {
      // Partial Failure Handler
      await recordAuditEvent({
        action: AuditAction.ACCOUNT_STATE_CONFLICT,
        targetId: targetUserAccess.id,
        metadata: { reason: "Failed to update UserAccess after password update" },
      });
      return NextResponse.json({ success: false, message: "Temporary failure activating account. Please submit again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }

    await recordAuditEvent({
      action: AuditAction.FIRST_PASSWORD_SET,
      targetId: targetUserAccess.id,
    });
    await recordAuditEvent({
      action: AuditAction.ACCOUNT_ACTIVATED,
      targetId: targetUserAccess.id,
    });

    return NextResponse.json({
      success: true,
      redirectTo: getRoleRedirect(targetUserAccess.role, targetUserAccess.studentProfileId)
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Set Password Error]:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
