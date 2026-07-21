import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { normalizeEmail, normalizeStudentLoginId, normalizeStaffLoginId } from "@/utils/normalization";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { checkPasswordLoginRateLimit, hashIdentifier } from "@/services/auth-rate-limit.service";
import { createClient } from "@/utils/supabase/server";

const GENERIC_FAILURE_RESPONSE = {
  success: false,
  message: "Unable to sign in with the provided credentials.",
};

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

    const { accountType, identifier, password } = body;
    if (!accountType || (accountType !== "STAFF" && accountType !== "STUDENT")) {
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    let resolvedEmail: string | null = null;
    let targetUserAccess: any = null;

    if (accountType === "STUDENT") {
      const loginId = normalizeStudentLoginId(identifier);
      if (loginId) {
        targetUserAccess = await prisma.userAccess.findUnique({ where: { loginId } });
        if (
          targetUserAccess &&
          targetUserAccess.role === UserRole.STUDENT &&
          targetUserAccess.studentProfileId
        ) {
          resolvedEmail = targetUserAccess.email;
        } else {
          targetUserAccess = null;
        }
      }
    } else if (accountType === "STAFF") {
      const normEmail = normalizeEmail(identifier);
      if (normEmail) {
        targetUserAccess = await prisma.userAccess.findFirst({
          where: {
            OR: [
              { email: normEmail },
              { loginId: normalizeStaffLoginId(normEmail) || undefined },
            ],
          },
        });
        if (
          targetUserAccess &&
          (targetUserAccess.role === UserRole.ADMIN ||
            targetUserAccess.role === UserRole.GK_SIR ||
            targetUserAccess.role === UserRole.HOD)
        ) {
          if (targetUserAccess.role === UserRole.HOD && !targetUserAccess.departmentId) {
            targetUserAccess = null;
          } else {
            resolvedEmail = targetUserAccess.email;
          }
        } else {
          targetUserAccess = null;
        }
      }
    }

    const auditTargetId = targetUserAccess?.id || hashIdentifier(identifier);

    // Rate limit check
    const rateLimit = await checkPasswordLoginRateLimit(auditTargetId);
    if (!rateLimit.allowed) {
      await recordAuditEvent({
        action: AuditAction.PASSWORD_LOGIN_RATE_LIMITED,
        targetId: auditTargetId,
        metadata: { reason: rateLimit.reason },
      });
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 429, headers: { "Cache-Control": "no-store" } });
    }

    // Eligibility check
    const isEligible =
      targetUserAccess &&
      targetUserAccess.authUserId &&
      targetUserAccess.status === AccountStatus.ACTIVE &&
      targetUserAccess.mustSetPassword === false &&
      targetUserAccess.firstLoginCompleted === true &&
      resolvedEmail;

    if (!isEligible) {
      await recordAuditEvent({
        action: AuditAction.PASSWORD_LOGIN_FAILED,
        targetId: auditTargetId,
        metadata: { reason: "Ineligible or unknown account" },
      });
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail as string,
      password
    });

    if (authError || !authData.user) {
      await recordAuditEvent({
        action: AuditAction.PASSWORD_LOGIN_FAILED,
        targetId: auditTargetId,
        metadata: { reason: "Supabase authentication failed" },
      });
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    // Post-authentication verification
    const isValid =
      authData.user.id === targetUserAccess.authUserId &&
      authData.user.email?.toLowerCase() === targetUserAccess.email.toLowerCase() &&
      targetUserAccess.status === AccountStatus.ACTIVE;

    if (!isValid) {
      await supabase.auth.signOut();
      await recordAuditEvent({
        action: AuditAction.SESSION_MISMATCH,
        targetId: auditTargetId,
        metadata: { reason: "Post-authentication validation failed (mismatch or inactive account)" },
      });
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    // Success! Update lastLoginAt
    try {
      await prisma.userAccess.update({
        where: { id: targetUserAccess.id },
        data: { lastLoginAt: new Date() }
      });
    } catch (updateError) {
      // Non-fatal error
      console.error("[Login] Failed to update lastLoginAt for user:", targetUserAccess.id);
    }

    await recordAuditEvent({
      action: AuditAction.PASSWORD_LOGIN_SUCCESS,
      targetId: auditTargetId,
    });

    return NextResponse.json({
      success: true,
      redirectTo: getRoleRedirect(targetUserAccess.role, targetUserAccess.studentProfileId)
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Login Error]:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
