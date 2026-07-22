import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { normalizeEmail, normalizeStudentLoginId, normalizeStaffLoginId } from "@/utils/normalization";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { checkOtpRequestRateLimit, hashIdentifier } from "@/services/auth-rate-limit.service";
import { createClient } from "@/utils/supabase/server";

const GENERIC_SUCCESS_RESPONSE = {
  success: true,
  message: "When the account is eligible, a verification code will be sent to the registered email.",
};

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

    const { accountType, identifier } = body;
    if (!accountType || (accountType !== "STAFF" && accountType !== "STUDENT")) {
      return NextResponse.json({ success: false, message: "Invalid account type" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!identifier || typeof identifier !== "string") {
      return NextResponse.json({ success: false, message: "Invalid identifier" }, { status: 400, headers: { "Cache-Control": "no-store" } });
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
            targetUserAccess = null; // Invalid link
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
            targetUserAccess = null; // HOD missing department
          } else {
            resolvedEmail = targetUserAccess.email;
          }
        } else {
          targetUserAccess = null;
        }
      }
    }

    const auditTargetId = targetUserAccess?.id || hashIdentifier(identifier);
    const isKnownAccount = !!targetUserAccess;

    // Rate limit check
    const rateLimit = await checkOtpRequestRateLimit(auditTargetId, isKnownAccount);
    if (!rateLimit.allowed) {
      await recordAuditEvent({
        action: AuditAction.FIRST_LOGIN_OTP_RATE_LIMITED,
        targetId: auditTargetId,
        metadata: { reason: rateLimit.reason, isKnownAccount },
      });
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE, { headers: { "Cache-Control": "no-store" } });
    }

    // Eligibility check
    const isEligible =
      targetUserAccess &&
      targetUserAccess.authUserId &&
      targetUserAccess.status === AccountStatus.PENDING &&
      targetUserAccess.mustSetPassword === true &&
      targetUserAccess.firstLoginCompleted === false &&
      resolvedEmail;

    if (!isEligible) {
      await recordAuditEvent({
        action: AuditAction.FIRST_LOGIN_OTP_REJECTED,
        targetId: auditTargetId,
        metadata: { reason: "Ineligible or unknown account", isKnownAccount },
      });
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE, { headers: { "Cache-Control": "no-store" } });
    }

    // Attempt to send OTP / Magic Link with production callback URL
    const origin = req.headers.get("origin") || (req.headers.get("x-forwarded-host") ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}` : null);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin || "https://code-chef-leaderboard.vercel.app";
    const emailRedirectTo = `${appUrl}/auth/callback`;

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: resolvedEmail as string,
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    });

    if (error) {
      await recordAuditEvent({
        action: AuditAction.FIRST_LOGIN_OTP_FAILED,
        targetId: auditTargetId,
        metadata: { error: error.message },
      });
      // Do not expose internal Supabase errors
      return NextResponse.json(GENERIC_SUCCESS_RESPONSE, { headers: { "Cache-Control": "no-store" } });
    }

    await recordAuditEvent({
      action: AuditAction.FIRST_LOGIN_OTP_REQUESTED,
      targetId: auditTargetId,
      metadata: { accountType },
    });

    return NextResponse.json(GENERIC_SUCCESS_RESPONSE, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[OTP Request Error]:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
