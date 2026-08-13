import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { normalizeEmail } from "@/utils/normalization";
import { getRoleHomePath } from "@/lib/auth";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";
import { checkPasswordLoginRateLimit, hashIdentifier } from "@/services/auth-rate-limit.service";
import { createClient } from "@/utils/supabase/server";

const GENERIC_FAILURE_RESPONSE = {
  success: false,
  message: "Invalid email or password.",
};

const RESTRICTED_PORTAL_RESPONSE = {
  success: false,
  message: "This portal is available to authorised administrators and institutional staff.",
};

const LOGIN_SERVICE_UNAVAILABLE_RESPONSE = {
  success: false,
  message: "The login service is temporarily unavailable. Please try again shortly.",
};

function getStaffRoleFallbackRedirect(email: string) {
  if (email.toLowerCase().includes("admin")) {
    return "/admin/control-center";
  }
  return "/dashboard";
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, message: "Invalid Content-Type" },
        { status: 415, headers: { "Cache-Control": "no-store" } }
      );
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 5000) {
      return NextResponse.json(
        { success: false, message: "Payload too large" },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { email, password } = body;

    // Validate email & password presence
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!password || typeof password !== "string" || !password.trim()) {
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const normEmail = normalizeEmail(email);
    if (!normEmail) {
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const auditTargetId = hashIdentifier(normEmail);

    // Check rate limit
    const rateLimit = await checkPasswordLoginRateLimit(auditTargetId);
    if (!rateLimit.allowed) {
      await recordAuditEvent({
        action: AuditAction.PASSWORD_LOGIN_RATE_LIMITED,
        targetId: auditTargetId,
        metadata: { reason: rateLimit.reason },
      });
      return NextResponse.json(
        { success: false, message: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Authenticate with Supabase Auth
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normEmail,
      password,
    });

    if (authError || !authData.user) {
      await recordAuditEvent({
        action: AuditAction.PASSWORD_LOGIN_FAILED,
        targetId: auditTargetId,
        metadata: { reason: "Invalid credentials" },
      });
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    // Fetch database UserAccess record
    let userAccess;
    try {
      userAccess = await prisma.userAccess.findFirst({
        where: {
          OR: [
            { authUserId: authData.user.id },
            { email: normEmail },
          ],
        },
      });
    } catch (dbError) {
      console.error("[Admin Login DB Error]:", dbError);
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          success: false,
          message: "Unable to load your staff access record. Please contact the administrator.",
          redirectTo: getStaffRoleFallbackRedirect(normEmail),
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // 1. Missing access record or Non-Admin/Staff role check
    if (!userAccess || (userAccess.role !== UserRole.ADMIN && userAccess.role !== UserRole.GK_SIR && userAccess.role !== UserRole.HOD)) {
      await supabase.auth.signOut();
      await recordAuditEvent({
        action: AuditAction.PASSWORD_LOGIN_FAILED,
        targetId: auditTargetId,
        metadata: { reason: "Non-admin/staff or missing UserAccess record", role: userAccess?.role },
      });
      return NextResponse.json(RESTRICTED_PORTAL_RESPONSE, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    // 2. Status checks: SUSPENDED or DISABLED
    if (userAccess.status === AccountStatus.SUSPENDED || userAccess.status === AccountStatus.DISABLED) {
      await supabase.auth.signOut();
      await recordAuditEvent({
        action: AuditAction.ACCOUNT_DISABLED,
        targetId: userAccess.id,
        metadata: { status: userAccess.status },
      });
      return NextResponse.json(
        { success: false, message: "This account has been suspended or disabled." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 3. Status check: PENDING
    if (userAccess.status === AccountStatus.PENDING) {
      await supabase.auth.signOut();
      await recordAuditEvent({
        action: AuditAction.PASSWORD_LOGIN_FAILED,
        targetId: userAccess.id,
        metadata: { reason: "Account activation pending" },
      });
      return NextResponse.json(
        { success: false, message: "Account activation pending. Please contact system administrator." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 4. Confirm ACTIVE status
    if (userAccess.status !== AccountStatus.ACTIVE) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { success: false, message: "Account is not active." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Ensure database UserAccess authUserId is connected to Supabase user ID if not set
    if (!userAccess.authUserId) {
      try {
        await prisma.userAccess.update({
          where: { id: userAccess.id },
          data: { authUserId: authData.user.id },
        });
      } catch (e) {
        console.error("Failed linking authUserId to UserAccess:", e);
      }
    }

    // Update lastLoginAt
    try {
      await prisma.userAccess.update({
        where: { id: userAccess.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (e) {
      console.error("Failed to update lastLoginAt:", e);
    }

    let auditAction = "STAFF_LOGIN";
    if (userAccess.role === UserRole.ADMIN) {
      auditAction = "ADMIN_LOGIN";
    } else if (userAccess.role === UserRole.GK_SIR) {
      auditAction = "GK_SIR_LOGIN";
    } else if (userAccess.role === UserRole.HOD) {
      auditAction = "HOD_LOGIN";
    }

    await recordAuditEvent({
      actorUserId: userAccess.id,
      action: auditAction,
      targetId: userAccess.id,
    });

    const redirectTo = getRoleHomePath(userAccess);

    return NextResponse.json(
      {
        success: true,
        redirectTo,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Admin Login Error]:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: "Method not allowed" },
    { status: 405, headers: { "Cache-Control": "no-store" } }
  );
}
