import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { normalizeEmail, normalizeStudentLoginId, normalizeStaffLoginId } from "@/utils/normalization";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { checkOtpVerifyRateLimit, hashIdentifier } from "@/services/auth-rate-limit.service";
import { createClient } from "@/utils/supabase/server";

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

    const { accountType, identifier, token } = body;

    if (!accountType || (accountType !== "STAFF" && accountType !== "STUDENT")) {
      return NextResponse.json({ success: false, message: "Invalid account type" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json({ success: false, message: "Invalid identifier" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!token || typeof token !== "string" || !/^\d{6}$/.test(token)) {
      return NextResponse.json({ success: false, message: "Invalid code format" }, { status: 400, headers: { "Cache-Control": "no-store" } });
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
          const studentProfile = await prisma.studentProfile.findUnique({
            where: { id: targetUserAccess.studentProfileId },
          });
          if (studentProfile && studentProfile.id === targetUserAccess.studentProfileId) {
            resolvedEmail = targetUserAccess.email;
          } else {
            targetUserAccess = null;
          }
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
    const rateLimit = await checkOtpVerifyRateLimit(auditTargetId);
    if (!rateLimit.allowed) {
      await recordAuditEvent({
        action: AuditAction.FIRST_LOGIN_OTP_RATE_LIMITED,
        targetId: auditTargetId,
        metadata: { reason: rateLimit.reason },
      });
      return NextResponse.json({ success: false, message: "Too many failed attempts. Please try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }

    if (!resolvedEmail || !targetUserAccess) {
      await recordAuditEvent({
        action: AuditAction.FIRST_LOGIN_OTP_FAILED,
        targetId: auditTargetId,
        metadata: { reason: "Unknown or ineligible account during verification" },
      });
      return NextResponse.json({ success: false, message: "Invalid verification code" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const supabase = await createClient();
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: resolvedEmail,
      token,
      type: "email",
    });

    if (verifyError || !verifyData.user) {
      await recordAuditEvent({
        action: AuditAction.FIRST_LOGIN_OTP_FAILED,
        targetId: auditTargetId,
        metadata: { reason: "Supabase verification failed", error: verifyError?.message },
      });
      return NextResponse.json({ success: false, message: "Invalid verification code" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    // Post-verification validation
    const isValid =
      verifyData.user.id === targetUserAccess.authUserId &&
      verifyData.user.email?.toLowerCase() === resolvedEmail.toLowerCase() &&
      targetUserAccess.status === AccountStatus.PENDING &&
      targetUserAccess.mustSetPassword === true &&
      targetUserAccess.firstLoginCompleted === false;

    if (!isValid) {
      // Rollback session
      await supabase.auth.signOut();
      await recordAuditEvent({
        action: AuditAction.FIRST_LOGIN_OTP_FAILED,
        targetId: auditTargetId,
        metadata: { reason: "Post-verification validation failed (mismatch or inactive account)" },
      });
      return NextResponse.json({ success: false, message: "Invalid verification code" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    // Success! 
    await recordAuditEvent({
      action: AuditAction.FIRST_LOGIN_OTP_VERIFIED,
      targetId: auditTargetId,
    });

    await recordAuditEvent({
      action: AuditAction.FIRST_LOGIN_SESSION_CREATED,
      targetId: auditTargetId,
    });

    return NextResponse.json({
      success: true,
      next: "/auth/set-password",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[OTP Verify Error]:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
